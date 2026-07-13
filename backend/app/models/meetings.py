from app.extensions import db
from app.utils.timezone import kst_now
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
    start_at = db.Column(db.DateTime)
    end_at = db.Column(db.DateTime)
    repeat_rule = db.Column(db.String(120))
    max_participants = db.Column(db.Integer, default=6, nullable=False)
    current_participants = db.Column(db.Integer, default=1, nullable=False)
    status = db.Column(db.String(30), default="open", nullable=False)
    suspended_at = db.Column(db.DateTime)
    approval_required = db.Column(db.Boolean, default=True, nullable=False)
    cover_image_url = db.Column(db.Text)
    view_count = db.Column(db.Integer, default=0, nullable=False)

    host = db.relationship("User", back_populates="hosted_meetings")
    sport = db.relationship("Sport")
    participants = db.relationship("Participant", back_populates="meeting", cascade="all, delete-orphan")
    chat_room = db.relationship("ChatRoom", back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    sessions = db.relationship(
        "MeetingSession",
        back_populates="meeting",
        cascade="all, delete-orphan",
        order_by="MeetingSession.start_at.asc()",
    )

    def status_label(self):
        if self.status == "open":
            return "모집중"
        if self.status == "full":
            return "모집 마감"
        if self.status == "closed":
            return "모집종료"
        if self.status == "cancelled":
            return "취소됨"
        if self.status == "suspended":
            return "폐쇄 유예"
        return "마감"

    def sync_status(self):
        if self.status not in ["closed", "cancelled", "suspended"]:
            if self.current_participants >= self.max_participants:
                self.status = "full"
            else:
                self.status = "open"

    def to_dict(self, current_user_id=None):
        remaining_days = None
        if self.status == "suspended" and self.suspended_at:
            elapsed = kst_now() - self.suspended_at
            remaining_days = max(0, 30 - elapsed.days)
            
        data = {
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
            "start_at": self.start_at.isoformat() if self.start_at else None,
            "end_at": self.end_at.isoformat() if self.end_at else None,
            "max_participants": self.max_participants,
            "current_participants": self.current_participants,
            "status": self.status,
            "status_label": self.status_label(),
            "approval_required": True,
            "cover_image_url": self.cover_image_url,
            "view_count": self.view_count,
            "chat_room_id": self.chat_room.id if self.chat_room else None,
            "suspended_at": self.suspended_at.isoformat() if self.suspended_at else None,
            "remaining_days": remaining_days,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        if current_user_id:
            participant = next((item for item in self.participants if item.user_id == current_user_id), None)
            data["my_participant"] = {
                "id": participant.id,
                "role": participant.role,
                "status": participant.status,
                "join_message": participant.join_message
            } if participant else None
        return data

    def to_list_dict(self, current_user_id=None):
        participant = None
        if current_user_id:
            participant = next((item for item in self.participants if item.user_id == current_user_id), None)
            
        remaining_days = None
        if self.status == "suspended" and self.suspended_at:
            elapsed = kst_now() - self.suspended_at
            remaining_days = max(0, 30 - elapsed.days)
            
        return {
            "id": self.id,
            "sport": self.sport.to_dict() if self.sport else None,
            "sport_name": self.sport.name if self.sport else "",
            "title": self.title,
            "description": self.description,
            "meeting_type": self.meeting_type,
            "location_name": self.location_name,
            "address": self.address,
            "start_at": self.start_at.isoformat() if self.start_at else None,
            "max_participants": self.max_participants,
            "current_participants": self.current_participants,
            "status": self.status,
            "status_label": self.status_label(),
            "cover_image_url": self.cover_image_url,
            "distance_km": getattr(self, "_distance_km", None),
            "chat_room_id": self.chat_room.id if self.chat_room else None,
            "suspended_at": self.suspended_at.isoformat() if self.suspended_at else None,
            "remaining_days": remaining_days,
            "host": {
                "id": self.host.id,
                "nickname": self.host.nickname,
                "profile_image_url": self.host.profile_image_url
            } if self.host else None,
            "my_participant": {
                "id": participant.id,
                "role": participant.role,
                "status": participant.status
            } if participant else None
        }

class MeetingSession(db.Model, TimestampMixin):
    __tablename__ = "meeting_sessions"

    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    session_number = db.Column(db.Integer, nullable=False)
    start_at = db.Column(db.DateTime, nullable=False, index=True)
    end_at = db.Column(db.DateTime)
    status = db.Column(db.String(20), default="scheduled", nullable=False)
    cancellation_reason = db.Column(db.String(255))

    meeting = db.relationship("Meeting", back_populates="sessions")

    __table_args__ = (
        db.UniqueConstraint("meeting_id", "session_number", name="uq_meeting_session_number"),
        db.UniqueConstraint("meeting_id", "start_at", name="uq_meeting_session_start_at"),
        db.CheckConstraint("status in ('scheduled', 'completed', 'cancelled')", name="ck_meeting_sessions_status"),
        db.CheckConstraint("end_at is null or end_at > start_at", name="ck_meeting_sessions_time_range"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "meeting_id": self.meeting_id,
            "session_number": self.session_number,
            "start_at": self.start_at.isoformat() if self.start_at else None,
            "end_at": self.end_at.isoformat() if self.end_at else None,
            "status": self.status,
            "cancellation_reason": self.cancellation_reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class Participant(db.Model):
    __tablename__ = "participants"

    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey("meetings.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    role = db.Column(db.String(30), default="member", nullable=False)
    status = db.Column(db.String(30), default="pending", nullable=False)
    join_message = db.Column(db.String(255))
    requested_at = db.Column(db.DateTime, default=kst_now, nullable=False)
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
