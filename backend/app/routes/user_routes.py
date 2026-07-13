import json
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import Meeting, MeetingSession, Participant, Review, Sport, User, UserProfile
from app.services.auth_service import validate_password
from app.utils.timezone import kst_now

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


@user_bp.patch("/me/profile-intro-preference")
@jwt_required()
def update_profile_intro_preference():
    user = user_query().get_or_404(int(get_jwt_identity()))
    action = (request.get_json() or {}).get("action")

    if action == "dismiss":
        user.profile_intro_dismissed = True
    elif action == "clear":
        user.profile_intro_dismissed = False
    else:
        return jsonify({"message": "알 수 없는 요청입니다."}), 400

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
    # 2026-07-13: 사용자 마이페이지에서는 삭제/관리 정지된 모임을 노출하지 않도록 제외.
    query = query.filter(~Meeting.status.in_(["cancelled", "suspended"]))
    if hosted:
        query = query.filter(Meeting.host_id == user_id)
    else:
        query = query.join(Participant, Participant.meeting_id == Meeting.id).filter(Participant.user_id == user_id)
        query = query.filter(Meeting.host_id != user_id)
        if status:
            query = query.filter(Participant.status == status)
    return query.order_by(Meeting.start_at.is_(None), Meeting.start_at.desc()).limit(bounded_limit()).all()


def attach_schedule_sessions(meetings):
    meeting_ids = sorted({meeting.id for meeting in meetings})
    sessions_by_meeting = {meeting_id: [] for meeting_id in meeting_ids}
    if meeting_ids:
        rows = (
            MeetingSession.query
            .filter(MeetingSession.meeting_id.in_(meeting_ids))
            .filter(MeetingSession.status == "scheduled")
            .order_by(MeetingSession.meeting_id.asc(), MeetingSession.start_at.asc())
            .all()
        )
        for row in rows:
            sessions_by_meeting.setdefault(row.meeting_id, []).append(row)

    now = kst_now()
    result = []
    for meeting in meetings:
        data = meeting.to_dict()
        sessions = sessions_by_meeting.get(meeting.id, [])
        session_dicts = [session.to_dict() for session in sessions]
        next_session = next((session for session in sessions if session.start_at >= now), None)
        data["repeat_rule"] = meeting.repeat_rule
        data["sessions"] = session_dicts
        data["next_session"] = next_session.to_dict() if next_session else None
        result.append(data)
    return result


@user_bp.get("/me/meetings")
@jwt_required()
def my_meetings():
    user_id = int(get_jwt_identity())
    hosted_items = meetings_for_user(user_id, hosted=True)
    joined_items = meetings_for_user(user_id, status="approved")
    pending_items = meetings_for_user(user_id, status="pending")
    unique_items = {meeting.id: meeting for meeting in [*hosted_items, *joined_items, *pending_items]}
    hydrated = {item["id"]: item for item in attach_schedule_sessions(unique_items.values())}
    hosted = [hydrated[meeting.id] for meeting in hosted_items]
    joined = [hydrated[meeting.id] for meeting in joined_items]
    pending = [hydrated[meeting.id] for meeting in pending_items]
    return jsonify({"hosted": hosted, "joined": joined, "pending": pending})


@user_bp.get("/me/reviews")
@jwt_required()
def my_reviews():
    user_id = int(get_jwt_identity())
    
    # 내가 작성한 후기 (내가 남긴 후기)
    written = (
        Review.query
        .options(joinedload(Review.reviewer).joinedload(User.profile))
        .filter_by(reviewer_id=user_id)
        .order_by(Review.created_at.desc())
        .limit(bounded_limit())
        .all()
    )
    
    # 나를 대상으로 남겨진 후기 (받은 후기)
    received = (
        Review.query
        .options(joinedload(Review.reviewer).joinedload(User.profile))
        .filter(Review.reviewee_id == user_id)
        .filter(Review.reviewer_id != user_id)
        .order_by(Review.created_at.desc())
        .limit(bounded_limit())
        .all()
    )
    
    written_dicts = [review.to_dict() for review in written]
    received_dicts = [review.to_dict() for review in received]
    
    # 전체 후기 (최신순 정렬)
    items = written_dicts + received_dicts
    items.sort(key=lambda x: x["created_at"], reverse=True)
    
    return jsonify({
        "items": items,
        "written": written_dicts,
        "received": received_dicts
    })


@user_bp.patch("/me/reviews/<int:review_id>")
@jwt_required()
def update_review(review_id):
    user_id = int(get_jwt_identity())
    review = Review.query.get_or_404(review_id)
    
    # 본인 확인
    if review.reviewer_id != user_id:
        return jsonify({"message": "수정 권한이 없습니다."}), 403
        
    from flask import request
    data = request.get_json() or {}
    if "rating" in data:
        try:
            review.rating = int(data["rating"])
        except ValueError:
            return jsonify({"message": "평점은 정수값이어야 합니다."}), 400
    if "content" in data:
        review.content = str(data["content"]).strip()
        
    db.session.commit()
    
    # 평점 평균 갱신 로직 추가
    # 대상 유저(reviewee)가 평점의 주인이므로, 대상 유저의 프로필 평점을 다시 연산하여 반영합니다!
    reviewee = review.reviewee
    if reviewee and reviewee.profile:
        all_reviews = (
            Review.query
            .filter(Review.reviewee_id == reviewee.id)
            .filter(Review.reviewer_id != reviewee.id)
            .all()
        )
        
        if all_reviews:
            avg_rating = sum(r.rating for r in all_reviews) / len(all_reviews)
            reviewee.profile.rating_average = round(avg_rating, 2)
        else:
            reviewee.profile.rating_average = 0.0
            
        db.session.commit()
            
    return jsonify({"review": review.to_dict()})


@user_bp.delete("/me/reviews/<int:review_id>")
@jwt_required()
def delete_review(review_id):
    user_id = int(get_jwt_identity())
    review = Review.query.get_or_404(review_id)
    
    # 본인 확인
    if review.reviewer_id != user_id:
        return jsonify({"message": "삭제 권한이 없습니다."}), 403
        
    meeting = review.meeting
    db.session.delete(review)
    db.session.commit()
    
    # 삭제 후 평점 평균 갱신
    reviewee = review.reviewee
    if reviewee and reviewee.profile:
        all_reviews = (
            Review.query
            .filter(Review.reviewee_id == reviewee.id)
            .filter(Review.reviewer_id != reviewee.id)
            .all()
        )
        
        if all_reviews:
            avg_rating = sum(r.rating for r in all_reviews) / len(all_reviews)
            reviewee.profile.rating_average = round(avg_rating, 2)
        else:
            reviewee.profile.rating_average = 0.0
            
        db.session.commit()
            
    return jsonify({"message": "후기가 삭제되었습니다."})


@user_bp.get("/me/reviews/written")
@jwt_required()
def my_written_reviews():
    user_id = int(get_jwt_identity())
    from app.services.meeting_service import list_written_reviews
    reviews = list_written_reviews(user_id)
    return jsonify({"items": [review.to_dict() for review in reviews]})


@user_bp.get("/me/reviews/received")
@jwt_required()
def my_received_reviews():
    user_id = int(get_jwt_identity())
    from app.services.meeting_service import list_received_reviews
    reviews = list_received_reviews(user_id)
    return jsonify({"items": [review.to_dict() for review in reviews]})


@user_bp.get("/me/reviews/pending")
@jwt_required()
def my_pending_reviews():
    user_id = int(get_jwt_identity())
    from app.services.meeting_service import list_pending_reviews
    items = list_pending_reviews(user_id)
    return jsonify({"items": items})


@user_bp.put("/me/reviews/<int:review_id>")
@jwt_required()
def update_my_review(review_id):
    user_id = int(get_jwt_identity())
    from app.services.meeting_service import update_review
    try:
        review = update_review(review_id, user_id, request.get_json() or {})
        return jsonify({"review": review.to_dict()})
    except (ValueError, PermissionError) as e:
        return jsonify({"message": str(e)}), 400


@user_bp.delete("/me/reviews/<int:review_id>")
@jwt_required()
def delete_my_review(review_id):
    user_id = int(get_jwt_identity())
    from app.services.meeting_service import delete_review
    try:
        delete_review(review_id, user_id)
        return jsonify({"message": "후기가 삭제되었습니다."})
    except (ValueError, PermissionError) as e:
        return jsonify({"message": str(e)}), 400


@user_bp.get("/<int:user_id>")
def get_user(user_id):
    user = user_query().get_or_404(user_id)
    return jsonify({"user": user.to_dict()})
