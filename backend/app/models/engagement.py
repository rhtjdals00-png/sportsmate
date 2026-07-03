from datetime import datetime

from app.extensions import db
from .common import TimestampMixin

class Review(db.Model):
    __tablename__ = "reviews"

    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey("meetings.id"), nullable=False)
    reviewer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    reviewer = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "meeting_id": self.meeting_id,
            "reviewer": self.reviewer.to_dict(),
            "rating": self.rating,
            "content": self.content,
            "created_at": self.created_at.isoformat()
        }

class Notice(db.Model, TimestampMixin):
    __tablename__ = "notices"
    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey("meetings.id"), nullable=False)
    title = db.Column(db.String(120), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_pinned = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "meeting_id": self.meeting_id,
            "title": self.title,
            "content": self.content,
            "is_pinned": self.is_pinned,
            "created_at": self.created_at.isoformat()
        }

class Vote(db.Model, TimestampMixin):
    __tablename__ = "votes"
    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey("meetings.id"), nullable=False)
    title = db.Column(db.String(120), nullable=False)
    options = db.relationship("VoteOption", backref="vote", cascade="all, delete-orphan")

    def to_dict(self, response_counts=None):
        response_counts = response_counts or getattr(self, "_response_counts", {})
        return {
            "id": self.id,
            "meeting_id": self.meeting_id,
            "title": self.title,
            "options": [option.to_dict(response_counts.get(option.id)) for option in self.options],
            "created_at": self.created_at.isoformat()
        }

class VoteOption(db.Model):
    __tablename__ = "vote_options"
    id = db.Column(db.Integer, primary_key=True)
    vote_id = db.Column(db.Integer, db.ForeignKey("votes.id"), nullable=False)
    text = db.Column(db.String(120), nullable=False)

    def to_dict(self, response_count=None):
        if response_count is None:
            response_count = getattr(self, "_response_count", None)
        if response_count is None:
            response_count = VoteResponse.query.filter_by(option_id=self.id).count()
        return {"id": self.id, "vote_id": self.vote_id, "text": self.text, "response_count": response_count}

class VoteResponse(db.Model):
    __tablename__ = "vote_responses"
    id = db.Column(db.Integer, primary_key=True)
    vote_id = db.Column(db.Integer, db.ForeignKey("votes.id"), nullable=False)
    option_id = db.Column(db.Integer, db.ForeignKey("vote_options.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

class Attendance(db.Model):
    __tablename__ = "attendances"
    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey("meetings.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.String(30), default="present", nullable=False)
    checked_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "meeting_id": self.meeting_id,
            "user": self.user.to_dict(),
            "status": self.status,
            "checked_at": self.checked_at.isoformat()
        }
