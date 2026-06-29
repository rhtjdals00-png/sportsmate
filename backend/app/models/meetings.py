from datetime import datetime

from app.extensions import db
from .common import TimestampMixin

class Meeting(db.Model, TimestampMixin):
    __tablename__ = "meetings"

    id = db.Column(db.Integer, primary_key=True)
    host_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    sport_id = db.Column(db.Integer, db.ForeignKey("sports.id"), nullable=False)
    title = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text, nullable=False)
    meeting_type = db.Column(db.String(30), default="one_time", nullable=False)
    purpose = db.Column(db.String(120), nullable=False)
    region_sido_code = db.Column(db.String(20))
    region_sigungu_code = db.Column(db.String(20))
    location_name = db.Column(db.String(160), nullable=False)
    address = db.Column(db.String(255), nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    start_at = db.Column(db.DateTime, nullable=False)
    end_at = db.Column(db.DateTime)
    repeat_rule = db.Column(db.String(120))
    max_participants = db.Column(db.Integer, default=6, nullable=False)
    current_participants = db.Column(db.Integer, default=1, nullable=False)
    status = db.Column(db.String(30), default="open", nullable=False)
    approval_required = db.Column(db.Boolean, default=True, nullable=False)
    cover_image_url = db.Column(db.String(500))
    view_count = db.Column(db.Integer, default=0, nullable=False)

    host = db.relationship("User", back_populates="hosted_meetings")
    sport = db.relationship("Sport")
    participants = db.relationship("Participant", back_populates="meeting", cascade="all, delete-orphan")
    chat_room = db.relationship("ChatRoom", back_populates="meeting", uselist=False, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "host": self.host.to_dict(),
            "sport": self.sport.to_dict(),
            "title": self.title,
            "description": self.description,
            "meeting_type": self.meeting_type,
            "purpose": self.purpose,
            "region_sido_code": self.region_sido_code,
            "region_sigungu_code": self.region_sigungu_code,
            "location_name": self.location_name,
            "address": self.address,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "start_at": self.start_at.isoformat(),
            "end_at": self.end_at.isoformat() if self.end_at else None,
            "max_participants": self.max_participants,
            "current_participants": self.current_participants,
            "status": self.status,
            "approval_required": self.approval_required,
            "cover_image_url": self.cover_image_url,
            "view_count": self.view_count
        }

class Participant(db.Model):
    __tablename__ = "participants"

    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey("meetings.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    role = db.Column(db.String(30), default="member", nullable=False)
    status = db.Column(db.String(30), default="pending", nullable=False)
    join_message = db.Column(db.String(255))
    requested_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    approved_at = db.Column(db.DateTime)
    rejected_at = db.Column(db.DateTime)

    meeting = db.relationship("Meeting", back_populates="participants")
    user = db.relationship("User")

    __table_args__ = (db.UniqueConstraint("meeting_id", "user_id", name="uq_participant_meeting_user"),)

    def to_dict(self):
        return {
            "id": self.id,
            "meeting_id": self.meeting_id,
            "user": self.user.to_dict(),
            "meeting": self.meeting.to_dict() if self.meeting else None,
            "role": self.role,
            "status": self.status,
            "join_message": self.join_message
        }
