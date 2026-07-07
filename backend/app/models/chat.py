from datetime import datetime, timedelta, timezone

from app.extensions import db
from .common import TimestampMixin


def get_kst_now():
    kst = timezone(timedelta(hours=9))
    return datetime.now(kst)


def to_kst_iso(value):
    if not value:
        return ""
    return (value + timedelta(hours=9)).isoformat()


class ChatRoom(db.Model, TimestampMixin):
    __tablename__ = "chat_rooms"

    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey("meetings.id"), nullable=False, unique=True)

    meeting = db.relationship("Meeting", back_populates="chat_room")
    messages = db.relationship(
        "ChatMessage",
        back_populates="room",
        cascade="all, delete-orphan",
        order_by="(ChatMessage.created_at, ChatMessage.id)",
    )

    def to_dict(self, current_user_id=None):
        last_message = self.messages[-1].to_dict() if self.messages else None
        return {
            "id": self.id,
            "meeting": self.meeting.to_dict(current_user_id=current_user_id) if self.meeting else None,
            "last_message": last_message,
            "unread_count": 0
        }

    def to_list_dict(self, last_message=None):
        if last_message is None:
            last_message = getattr(self, "_last_message", None)
        if last_message is None:
            last_message = (
                ChatMessage.query
                .filter_by(chat_room_id=self.id)
                .order_by(ChatMessage.created_at.desc())
                .first()
            )
        meeting = self.meeting
        return {
            "id": self.id,
            "meeting": meeting.to_list_dict() if meeting else None,
            "last_message": last_message.to_dict() if last_message else None,
            "unread_count": 0
        }

class ChatMessage(db.Model):
    __tablename__ = "chat_messages"

    id = db.Column(db.Integer, primary_key=True)
    chat_room_id = db.Column(db.Integer, db.ForeignKey("chat_rooms.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    message_type = db.Column(db.String(30), default="text", nullable=False)
    attachment_url = db.Column(db.Text, nullable=True)
    attachment_name = db.Column(db.String(255), nullable=True)
    location_latitude = db.Column(db.Float, nullable=True)
    location_longitude = db.Column(db.Float, nullable=True)
    location_label = db.Column(db.String(255), nullable=True)
    reply_to_message_id = db.Column(db.Integer, db.ForeignKey("chat_messages.id"), nullable=True)
    reply_to_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    reply_to_sender_name = db.Column(db.String(120), nullable=True)
    reply_to_content = db.Column(db.Text, nullable=True)
    reply_to_message_type = db.Column(db.String(30), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    room = db.relationship("ChatRoom", back_populates="messages")
    sender = db.relationship("User", foreign_keys=[user_id])
    reply_to = db.relationship("ChatMessage", remote_side=[id], uselist=False)

    def to_reply_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "sender": self.sender.to_dict() if self.sender else None,
            "content": self.content,
            "message_type": self.message_type,
            "attachment_name": self.attachment_name,
            "location_label": self.location_label,
            "reply_to_user_id": self.reply_to_user_id,
            "reply_to_sender_name": self.reply_to_sender_name,
            "reply_to_content": self.reply_to_content,
            "reply_to_message_type": self.reply_to_message_type,
        }

    def to_dict(self):
        return {
            "id": self.id,
            "chat_room_id": self.chat_room_id,
            "user_id": self.user_id,
            "sender": self.sender.to_dict() if self.sender else None,
            "content": self.content,
            "message_type": self.message_type,
            "attachment_url": self.attachment_url,
            "attachment_name": self.attachment_name,
            "location_latitude": self.location_latitude,
            "location_longitude": self.location_longitude,
            "location_label": self.location_label,
            "reply_to_message_id": self.reply_to_message_id,
            "reply_to_user_id": self.reply_to_user_id,
            "reply_to_sender_name": self.reply_to_sender_name,
            "reply_to_content": self.reply_to_content,
            "reply_to_message_type": self.reply_to_message_type,
            "reply_to": self.reply_to.to_reply_dict() if self.reply_to else None,
            "read_count": getattr(self, "_read_count", 0),
            "created_at": to_kst_iso(self.created_at)
        }


class ChatMessageRead(db.Model):
    __tablename__ = "chat_message_reads"

    id = db.Column(db.Integer, primary_key=True)
    chat_message_id = db.Column(db.Integer, db.ForeignKey("chat_messages.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    read_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (db.UniqueConstraint("chat_message_id", "user_id", name="uq_chat_message_read_user"),)


class DirectChatRoom(db.Model, TimestampMixin):
    __tablename__ = "direct_chat_rooms"

    id = db.Column(db.Integer, primary_key=True)
    user_a_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    user_b_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    user_a = db.relationship("User", foreign_keys=[user_a_id])
    user_b = db.relationship("User", foreign_keys=[user_b_id])
    messages = db.relationship("DirectChatMessage", back_populates="room", cascade="all, delete-orphan", order_by="(DirectChatMessage.created_at, DirectChatMessage.id)")

    __table_args__ = (db.UniqueConstraint("user_a_id", "user_b_id", name="uq_direct_chat_pair"),)

    def other_user(self, user_id):
        return self.user_b if self.user_a_id == user_id else self.user_a

    def to_dict(self, current_user_id=None):
        last_message = self.messages[-1].to_dict() if self.messages else None
        return {
            "id": self.id,
            "other_user": self.other_user(current_user_id).to_dict() if current_user_id else None,
            "last_message": last_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class DirectChatMessage(db.Model):
    __tablename__ = "direct_chat_messages"

    id = db.Column(db.Integer, primary_key=True)
    direct_chat_room_id = db.Column(db.Integer, db.ForeignKey("direct_chat_rooms.id"), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    room = db.relationship("DirectChatRoom", back_populates="messages")
    sender = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "direct_chat_room_id": self.direct_chat_room_id,
            "sender_id": self.sender_id,
            "sender": self.sender.to_dict() if self.sender else None,
            "content": self.content,
            "created_at": to_kst_iso(self.created_at),
        }
