from app.extensions import db
from app.utils.timezone import kst_now
from .common import TimestampMixin

class Review(db.Model):
    __tablename__ = "reviews"

    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey("meetings.id"), nullable=False)
    reviewer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    reviewee_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    rating = db.Column(db.Integer, nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=kst_now, nullable=False)

    reviewer = db.relationship("User", foreign_keys=[reviewer_id], backref="written_reviews")
    reviewee = db.relationship("User", foreign_keys=[reviewee_id], backref="received_reviews")
    meeting = db.relationship("Meeting")

    def to_dict(self):
        return {
            "id": self.id,
            "meeting_id": self.meeting_id,
            "meeting": {"id": self.meeting.id, "title": self.meeting.title} if self.meeting else None,
            "meeting_title": self.meeting.title if self.meeting else "삭제된 모임",
            "meeting_host_nickname": self.meeting.host.nickname if (self.meeting and self.meeting.host) else "방장 없음",
            "reviewer": self.reviewer.to_dict() if self.reviewer else None,
            "reviewee_id": self.reviewee_id,
            "reviewee": self.reviewee.to_dict() if self.reviewee else None,
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
    notice_type = db.Column(db.String(20), default="text", nullable=False)
    vote_id = db.Column(db.Integer, db.ForeignKey("votes.id", ondelete="SET NULL"), nullable=True)
    session_id = db.Column(db.Integer, db.ForeignKey("meeting_sessions.id", ondelete="SET NULL"), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "meeting_id": self.meeting_id,
            "title": self.title,
            "content": self.content,
            "is_pinned": self.is_pinned,
            "notice_type": self.notice_type,
            "vote_id": self.vote_id,
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat()
        }

class Vote(db.Model, TimestampMixin):
    __tablename__ = "votes"
    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey("meetings.id"), nullable=False)
    title = db.Column(db.String(120), nullable=False)
    ends_at = db.Column(db.DateTime, nullable=True)
    allow_multiple = db.Column(db.Boolean, default=False, nullable=False)
    is_anonymous = db.Column(db.Boolean, default=True, nullable=False)
    options = db.relationship("VoteOption", backref="vote", cascade="all, delete-orphan")

    def to_dict(self, response_counts=None):
        response_counts = response_counts or getattr(self, "_response_counts", {})
        return {
            "id": self.id,
            "meeting_id": self.meeting_id,
            "title": self.title,
            "ends_at": self.ends_at.isoformat() if self.ends_at else None,
            "allow_multiple": self.allow_multiple,
            "is_anonymous": self.is_anonymous,
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
    user = db.relationship("User")

class Attendance(db.Model):
    __tablename__ = "attendances"
    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey("meetings.id"), nullable=False)
    meeting_session_id = db.Column(
        db.Integer,
        db.ForeignKey("meeting_sessions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.String(30), default="present", nullable=False)
    checked_at = db.Column(db.DateTime, default=kst_now, nullable=False)

    user = db.relationship("User")
    meeting_session = db.relationship("MeetingSession")

    __table_args__ = (
        db.UniqueConstraint("meeting_session_id", "user_id", name="uq_attendance_session_user"),
        db.CheckConstraint("status in ('present', 'absent')", name="ck_attendances_status"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "meeting_id": self.meeting_id,
            "meeting_session_id": self.meeting_session_id,
            "user": self.user.to_dict(),
            "status": self.status,
            "checked_at": self.checked_at.isoformat()
        }


class AttendanceCheckinWindow(db.Model, TimestampMixin):
    __tablename__ = "attendance_checkin_windows"

    id = db.Column(db.Integer, primary_key=True)
    meeting_session_id = db.Column(
        db.Integer,
        db.ForeignKey("meeting_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    opens_at = db.Column(db.DateTime, nullable=False)
    closes_at = db.Column(db.DateTime, nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    meeting_session = db.relationship("MeetingSession")
    creator = db.relationship("User")

    def to_dict(self):
        now = kst_now()
        return {
            "id": self.id,
            "meeting_session_id": self.meeting_session_id,
            "opens_at": self.opens_at.isoformat(),
            "closes_at": self.closes_at.isoformat(),
            "is_active": self.is_active,
            "is_open": self.is_active and self.opens_at <= now < self.closes_at,
        }
