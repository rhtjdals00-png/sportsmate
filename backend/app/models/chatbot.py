from datetime import datetime
from app.extensions import db
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
    role = db.Column(db.String(30), nullable=False)  # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    session = db.relationship("ChatbotSession", back_populates="messages")

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
