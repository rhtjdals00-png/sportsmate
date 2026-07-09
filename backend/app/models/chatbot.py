from datetime import datetime
from app.extensions import db
from app.utils.timezone import kst_now
from .common import TimestampMixin


class ChatbotSession(db.Model, TimestampMixin):
    __tablename__ = "chatbot_sessions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(255), default="새로운 대화", nullable=False)

    user = db.relationship("User", backref=db.backref("chatbot_sessions", cascade="all, delete-orphan"))
    messages = db.relationship(
        "ChatbotMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatbotMessage.created_at",
    )

    def to_dict(self):
        last_message = self.messages[-1].to_dict() if self.messages else None
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_message": last_message,
        }


class ChatbotMessage(db.Model):
    __tablename__ = "chatbot_messages"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("chatbot_sessions.id", ondelete="CASCADE"), nullable=False)
    role = db.Column(db.String(30), nullable=False)  # user, assistant, system, tool
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=kst_now, nullable=False)

    session = db.relationship("ChatbotSession", back_populates="messages")

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ChatbotUserMemory(db.Model, TimestampMixin):
    __tablename__ = "chatbot_user_memories"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    preferred_sports = db.Column(db.Text, default="", nullable=False)
    preferred_regions = db.Column(db.Text, default="", nullable=False)
    preferred_times = db.Column(db.Text, default="", nullable=False)
    interest_keywords = db.Column(db.Text, default="", nullable=False)
    summary = db.Column(db.Text, default="", nullable=False)
    last_extracted_at = db.Column(db.DateTime)

    user = db.relationship("User", backref=db.backref("chatbot_memory", uselist=False, cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "preferred_sports": self.preferred_sports,
            "preferred_regions": self.preferred_regions,
            "preferred_times": self.preferred_times,
            "interest_keywords": self.interest_keywords,
            "summary": self.summary,
            "last_extracted_at": self.last_extracted_at.isoformat() if self.last_extracted_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
