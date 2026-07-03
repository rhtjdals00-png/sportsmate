import json
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db
from .common import TimestampMixin


class User(db.Model, TimestampMixin):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    auth_user_id = db.Column(db.String(120), unique=True, nullable=True, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=True)
    provider = db.Column(db.String(40), default="email", nullable=False)
    provider_id = db.Column(db.String(120))
    name = db.Column(db.String(80), nullable=False)
    phone_number = db.Column(db.String(30), nullable=True)
    nickname = db.Column(db.String(80), nullable=False, index=True)
    user_tag = db.Column(db.String(4), unique=True, nullable=False, index=True)
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
        provider_values = {item.strip() for item in (self.provider or "").split(",") if item.strip()}
        return {
            "id": self.id,
            "auth_user_id": self.auth_user_id,
            "email": self.email,
            "name": self.name,
            "phone_number": self.phone_number,
            "nickname": self.nickname,
            "user_tag": self.user_tag,
            "user_tag_display": f"[{self.user_tag}]" if self.user_tag else "",
            "nickname_with_tag": f"{self.nickname} [{self.user_tag}]" if self.user_tag else self.nickname,
            "profile_image_url": self.profile_image_url,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "provider": self.provider,
            # 2026-07-02: 소셜 계정의 이메일 연동 여부를 프론트 분기용으로 제공.
            "has_password": "email" in provider_values,
            "profile": {
                "region": profile.region if profile else "",
                "region_latitude": profile.region_latitude if profile else None,
                "region_longitude": profile.region_longitude if profile else None,
                "region_2": profile.region_2 if profile else "",
                "region_2_latitude": profile.region_2_latitude if profile else None,
                "region_2_longitude": profile.region_2_longitude if profile else None,
                "bio": profile.bio if profile else "",
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
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    region = db.Column(db.String(120), default="서울")
    region_latitude = db.Column(db.Float)
    region_longitude = db.Column(db.Float)
    region_2 = db.Column(db.String(120), default="")
    region_2_latitude = db.Column(db.Float)
    region_2_longitude = db.Column(db.Float)
    bio = db.Column(db.String(160), default="")
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


