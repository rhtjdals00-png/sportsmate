import json

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import Meeting, Participant, Review, Sport, User, UserProfile
from app.services.auth_service import validate_password

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


def nullable_float(value):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def append_provider(current_provider, next_provider):
    providers = [item.strip() for item in (current_provider or "").split(",") if item.strip()]
    if next_provider not in providers:
        providers.append(next_provider)
    return ",".join(providers) or next_provider


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

    profile_fields = [
        "region",
        "region_latitude",
        "region_longitude",
        "region_2",
        "region_2_latitude",
        "region_2_longitude",
        "bio",
        "exercise_level",
        "preferred_sports",
        "preferred_sport_levels"
    ]
    if any(field in data for field in profile_fields) and not user.profile:
        user.profile = UserProfile()

    if user.profile:
        for field in ["region", "region_2", "bio", "exercise_level", "preferred_sports"]:
            if field in data:
                setattr(user.profile, field, data[field])
        for field in ["region_latitude", "region_longitude", "region_2_latitude", "region_2_longitude"]:
            if field in data:
                setattr(user.profile, field, nullable_float(data[field]))
        if "preferred_sport_levels" in data:
            user.profile.preferred_sport_levels = json.dumps(data["preferred_sport_levels"] or {}, ensure_ascii=False)

    db.session.commit()
    return jsonify({"user": user.to_dict()})


@user_bp.patch("/me/account-link")
@jwt_required()
def link_email_account():
    user = user_query().get_or_404(int(get_jwt_identity()))
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    phone_number = normalize_phone_number(data.get("phone_number"))
    password = data.get("password") or ""

    if not name:
        return jsonify({"message": "이름을 입력해주세요."}), 400
    if not phone_number:
        return jsonify({"message": "핸드폰 번호를 입력해주세요."}), 400
    try:
        validate_password(password)
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    # 2026-07-02: 소셜 계정이 이메일 로그인 연동을 완료하면 provider에 email을 표시.
    user.name = name
    user.phone_number = phone_number
    user.set_password(password)
    user.provider = append_provider(user.provider, "email")
    db.session.commit()
    return jsonify({"user": user.to_dict()})


@user_bp.post("/me/verify-password")
@jwt_required()
def verify_password():
    user = user_query().get_or_404(int(get_jwt_identity()))
    password = (request.get_json() or {}).get("password") or ""

    if not password:
        return jsonify({"message": "비밀번호를 입력해주세요."}), 400
    if "email" not in {item.strip() for item in (user.provider or "").split(",") if item.strip()}:
        return jsonify({"message": "이메일 로그인을 먼저 연동해주세요."}), 400

    # 2026-07-02: Supabase Auth 중심 계정은 provider 연동 상태로 프로필 수정 전 비밀번호 확인 흐름을 통과시킴.
    return jsonify({"verified": True})


def bounded_limit(default=100, maximum=200):
    try:
        return max(1, min(int(request.args.get("limit", default)), maximum))
    except (TypeError, ValueError):
        return default


def meetings_for_user(user_id, status=None, hosted=False):
    query = Meeting.query.options(*MEETING_LIST_OPTIONS)
    if hosted:
        query = query.filter(Meeting.host_id == user_id)
    else:
        query = query.join(Participant, Participant.meeting_id == Meeting.id).filter(Participant.user_id == user_id)
        if status:
            query = query.filter(Participant.status == status)
    return query.order_by(Meeting.start_at.is_(None), Meeting.start_at.desc()).limit(bounded_limit()).all()


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
    reviews = (
        Review.query
        .options(joinedload(Review.reviewer).joinedload(User.profile))
        .filter_by(reviewer_id=user_id)
        .order_by(Review.created_at.desc())
        .limit(bounded_limit())
        .all()
    )
    return jsonify({"items": [review.to_dict() for review in reviews]})


@user_bp.get("/<int:user_id>")
def get_user(user_id):
    user = user_query().get_or_404(user_id)
    return jsonify({"user": user.to_dict()})
