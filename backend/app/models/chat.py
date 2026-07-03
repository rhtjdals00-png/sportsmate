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
    messages = db.relationship("ChatMessage", back_populates="room", cascade="all, delete-orphan")

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
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    room = db.relationship("ChatRoom", back_populates="messages")
    sender = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "chat_room_id": self.chat_room_id,
            "user_id": self.user_id,
            "sender": self.sender.to_dict(),
            "content": self.content,
            "message_type": self.message_type,
            "created_at": to_kst_iso(self.created_at)
        }
