import json
from datetime import datetime
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db


class TimestampMixin:
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class User(db.Model, TimestampMixin):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    provider = db.Column(db.String(40), default="email", nullable=False)
    provider_id = db.Column(db.String(120))
    nickname = db.Column(db.String(80), nullable=False)
    profile_image_url = db.Column(db.Text)
    role = db.Column(db.String(30), default="user", nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    profile = db.relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    hosted_meetings = db.relationship("Meeting", back_populates="host")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        profile = self.profile
        return {
            "id": self.id,
            "email": self.email,
            "nickname": self.nickname,
            "profile_image_url": self.profile_image_url,
            "role": self.role,
            "is_active": self.is_active,
            "profile": {
                "region": profile.region if profile else "",
                "exercise_level": profile.exercise_level if profile else "",
                "preferred_sports": profile.preferred_sports if profile else "",
                "preferred_sport_levels": profile.preferred_sport_levels_dict() if profile else {},
                "rating_average": profile.rating_average if profile else 0,
                "attendance_rate": profile.attendance_rate if profile else 0
            }
        }


class UserProfile(db.Model):
    __tablename__ = "user_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    region = db.Column(db.String(120), default="서울")
    exercise_level = db.Column(db.String(40), default="beginner")
    preferred_sports = db.Column(db.String(255), default="")
    preferred_sport_levels = db.Column(db.Text, default="{}")
    rating_average = db.Column(db.Float, default=0)
    attendance_rate = db.Column(db.Float, default=0)

    user = db.relationship("User", back_populates="profile")

    def preferred_sport_levels_dict(self):
        try:
            return json.loads(self.preferred_sport_levels or "{}")
        except (TypeError, json.JSONDecodeError):
            return {}


class SportCategory(db.Model):
    __tablename__ = "sport_categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False, unique=True)
    purpose = db.Column(db.String(120), nullable=False, default="파트너 모집")
    sports = db.relationship("Sport", back_populates="category", cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "purpose": self.purpose}


class Sport(db.Model):
    __tablename__ = "sports"

    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey("sport_categories.id"), nullable=False)
    name = db.Column(db.String(80), nullable=False)

    category = db.relationship("SportCategory", back_populates="sports")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "category_id": self.category_id, "category": self.category.to_dict()}


class Region(db.Model):
    __tablename__ = "regions"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False, index=True)
    name = db.Column(db.String(80), nullable=False)
    level = db.Column(db.String(20), nullable=False)
    parent_code = db.Column(db.String(20), db.ForeignKey("regions.code"))
    full_name = db.Column(db.String(160), nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)

    parent = db.relationship("Region", remote_side=[code])

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "level": self.level,
            "parent_code": self.parent_code,
            "full_name": self.full_name,
            "latitude": self.latitude,
            "longitude": self.longitude
        }


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


class ChatRoom(db.Model, TimestampMixin):
    __tablename__ = "chat_rooms"

    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey("meetings.id"), nullable=False, unique=True)

    meeting = db.relationship("Meeting", back_populates="chat_room")
    messages = db.relationship("ChatMessage", back_populates="room", cascade="all, delete-orphan")

    def to_dict(self):
        last_message = self.messages[-1].to_dict() if self.messages else None
        return {"id": self.id, "meeting": self.meeting.to_dict(), "last_message": last_message, "unread_count": 0}


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
            "created_at": self.created_at.isoformat()
        }


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    type = db.Column(db.String(60), nullable=False)
    title = db.Column(db.String(120), nullable=False)
    message = db.Column(db.String(255), nullable=False)
    link_url = db.Column(db.String(255))
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "link_url": self.link_url,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat()
        }


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

    def to_dict(self):
        return {
            "id": self.id,
            "meeting_id": self.meeting_id,
            "title": self.title,
            "options": [option.to_dict() for option in self.options],
            "created_at": self.created_at.isoformat()
        }


class VoteOption(db.Model):
    __tablename__ = "vote_options"
    id = db.Column(db.Integer, primary_key=True)
    vote_id = db.Column(db.Integer, db.ForeignKey("votes.id"), nullable=False)
    text = db.Column(db.String(120), nullable=False)

    def to_dict(self):
        count = VoteResponse.query.filter_by(option_id=self.id).count()
        return {"id": self.id, "vote_id": self.vote_id, "text": self.text, "response_count": count}


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


class Report(db.Model):
    __tablename__ = "reports"
    id = db.Column(db.Integer, primary_key=True)
    reporter_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    target_type = db.Column(db.String(40), nullable=False)
    target_id = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(30), default="pending", nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class PushSubscription(db.Model, TimestampMixin):
    __tablename__ = "push_subscriptions"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    endpoint = db.Column(db.Text, nullable=False)
    p256dh = db.Column(db.String(255), nullable=False)
    auth = db.Column(db.String(255), nullable=False)
    user_agent = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True, nullable=False)
