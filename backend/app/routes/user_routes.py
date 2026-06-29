import json

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models import Participant, Review, User

user_bp = Blueprint("users", __name__)


def normalize_phone_number(value):
    digits = "".join(ch for ch in (value or "") if ch.isdigit())[:11]
    if not digits:
        return None
    if len(digits) <= 3:
        return digits
    if len(digits) <= 7:
        return f"{digits[:3]}-{digits[3:]}"
    return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"


@user_bp.get("/me")
@jwt_required()
def get_me():
    user = User.query.get_or_404(int(get_jwt_identity()))
    return jsonify({"user": user.to_dict()})


@user_bp.patch("/me")
@jwt_required()
def update_me():
    user = User.query.get_or_404(int(get_jwt_identity()))
    data = request.get_json() or {}

    for field in ["name", "phone_number", "nickname", "profile_image_url"]:
        if field in data:
            setattr(user, field, normalize_phone_number(data[field]) if field == "phone_number" else data[field])

    if user.profile:
        for field in ["region", "bio", "exercise_level", "preferred_sports"]:
            if field in data:
                setattr(user.profile, field, data[field])
        if "preferred_sport_levels" in data:
            user.profile.preferred_sport_levels = json.dumps(data["preferred_sport_levels"] or {}, ensure_ascii=False)

    db.session.commit()
    return jsonify({"user": user.to_dict()})


@user_bp.get("/me/meetings")
@jwt_required()
def my_meetings():
    user_id = int(get_jwt_identity())
    hosted = [meeting.to_dict() for meeting in User.query.get_or_404(user_id).hosted_meetings]
    joined_rows = Participant.query.filter_by(user_id=user_id, status="approved").all()
    joined = [row.meeting.to_dict() for row in joined_rows]
    pending_rows = Participant.query.filter_by(user_id=user_id, status="pending").all()
    pending = [row.meeting.to_dict() for row in pending_rows]
    return jsonify({"hosted": hosted, "joined": joined, "pending": pending})


@user_bp.get("/me/reviews")
@jwt_required()
def my_reviews():
    user_id = int(get_jwt_identity())
    reviews = Review.query.filter_by(reviewer_id=user_id).order_by(Review.created_at.desc()).all()
    return jsonify({"items": [review.to_dict() for review in reviews]})


@user_bp.get("/<int:user_id>")
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify({"user": user.to_dict()})
