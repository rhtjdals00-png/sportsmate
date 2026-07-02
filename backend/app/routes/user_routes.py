import json

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import Meeting, Participant, Review, Sport, User, UserProfile

user_bp = Blueprint("users", __name__)


MEETING_LIST_OPTIONS = (
    joinedload(Meeting.host).joinedload(User.profile),
    joinedload(Meeting.sport).joinedload(Sport.category),
    joinedload(Meeting.participants),
    joinedload(Meeting.chat_room),
)


def normalize_phone_number(value):
    digits = "".join(ch for ch in (value or "") if ch.isdigit())[:11]
    if not digits:
        return None
    if len(digits) <= 3:
        return digits
    if len(digits) <= 7:
        return f"{digits[:3]}-{digits[3:]}"
    return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"


def user_query():
    return User.query.options(joinedload(User.profile))


@user_bp.get("/me")
@jwt_required()
def get_me():
    user = user_query().get_or_404(int(get_jwt_identity()))
    return jsonify({"user": user.to_dict()})


@user_bp.patch("/me")
@jwt_required()
def update_me():
    user = user_query().get_or_404(int(get_jwt_identity()))
    data = request.get_json() or {}

    for field in ["name", "phone_number", "nickname", "profile_image_url"]:
        if field in data:
            setattr(user, field, normalize_phone_number(data[field]) if field == "phone_number" else data[field])

    profile_fields = ["region", "bio", "exercise_level", "preferred_sports", "preferred_sport_levels"]
    if any(field in data for field in profile_fields) and not user.profile:
        user.profile = UserProfile()

    if user.profile:
        for field in ["region", "bio", "exercise_level", "preferred_sports"]:
            if field in data:
                setattr(user.profile, field, data[field])
        if "preferred_sport_levels" in data:
            user.profile.preferred_sport_levels = json.dumps(data["preferred_sport_levels"] or {}, ensure_ascii=False)

    db.session.commit()
    return jsonify({"user": user.to_dict()})


def meetings_for_user(user_id, status=None, hosted=False):
    query = Meeting.query.options(*MEETING_LIST_OPTIONS)
    if hosted:
        query = query.filter(Meeting.host_id == user_id)
    else:
        query = query.join(Participant, Participant.meeting_id == Meeting.id).filter(Participant.user_id == user_id)
        if status:
            query = query.filter(Participant.status == status)
    return query.order_by(Meeting.start_at.desc()).all()


@user_bp.get("/me/meetings")
@jwt_required()
def my_meetings():
    user_id = int(get_jwt_identity())
    hosted = [meeting.to_dict() for meeting in meetings_for_user(user_id, hosted=True)]
    joined = [meeting.to_dict() for meeting in meetings_for_user(user_id, status="approved")]
    pending = [meeting.to_dict() for meeting in meetings_for_user(user_id, status="pending")]
    return jsonify({"hosted": hosted, "joined": joined, "pending": pending})


@user_bp.get("/me/reviews")
@jwt_required()
def my_reviews():
    user_id = int(get_jwt_identity())
    reviews = Review.query.filter_by(reviewer_id=user_id).order_by(Review.created_at.desc()).all()
    return jsonify({"items": [review.to_dict() for review in reviews]})


@user_bp.get("/<int:user_id>")
def get_user(user_id):
    user = user_query().get_or_404(user_id)
    return jsonify({"user": user.to_dict()})
