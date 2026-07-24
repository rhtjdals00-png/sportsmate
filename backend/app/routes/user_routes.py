import json
import time
from collections import defaultdict
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import Attendance, Meeting, MeetingSession, Participant, Review, Sport, User, UserProfile
from app.services.meeting_service import ensure_regular_meeting_sessions
from app.utils.timezone import kst_now

user_bp = Blueprint("users", __name__)

MAX_INTEREST_SPORTS = 6


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


def normalize_preferred_sports(value):
    if value is None:
        return ""
    if not isinstance(value, str):
        raise TypeError("preferred_sports must be a comma-separated string")

    normalized = []
    seen = set()
    for item in value.split(","):
        sport_name = item.strip()
        if not sport_name or sport_name in seen:
            continue
        seen.add(sport_name)
        normalized.append(sport_name)
    return ", ".join(normalized)


def user_query():
    return User.query.options(joinedload(User.profile))


@user_bp.get("/me")
@jwt_required()
def get_me():
    user = user_query().get_or_404(int(get_jwt_identity()))
    return jsonify({"user": user.to_dict(include_private=True)})


@user_bp.patch("/me")
@jwt_required()
def update_me():
    user = user_query().get_or_404(int(get_jwt_identity()))
    data = request.get_json() or {}

    if "preferred_sports" in data:
        try:
            normalized_sports = normalize_preferred_sports(data["preferred_sports"])
        except TypeError:
            return jsonify({"message": "관심 종목 형식이 올바르지 않습니다."}), 400
        normalized_sport_names = normalized_sports.split(", ") if normalized_sports else []
        if len(normalized_sport_names) > MAX_INTEREST_SPORTS:
            return jsonify({
                "code": "INTEREST_SPORT_LIMIT_EXCEEDED",
                "message": "관심 종목은 최대 6개까지 선택할 수 있습니다."
            }), 400
        data["preferred_sports"] = normalized_sports

    if "phone_number" in data:
        phone_number = normalize_phone_number(data["phone_number"])
        if phone_number:
            existing = User.query.filter(User.phone_number == phone_number, User.id != user.id).first()
            if existing:
                return jsonify({"message": "이미 등록되었거나 다른 계정에 연동된 핸드폰 번호입니다. 다른 번호를 입력해주세요."}), 400

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
    return jsonify({"user": user.to_dict(include_private=True)})


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
    return jsonify({"user": user.to_dict(include_private=True)})

@user_bp.delete("/me")
@jwt_required()
def delete_me():
    user = user_query().get_or_404(int(get_jwt_identity()))
    from app.utils.timezone import kst_now
    
    try:
        user.status = "withdrawn_pending"
        user.role = "pending_withdrawal"
        user.withdrawn_at = kst_now()
        user.deleted_at = kst_now()
        db.session.commit()
        return jsonify({
            "message": "30일 탈퇴 유예 기간이 시작되었습니다. 30일 이내 재로그인 시 계정을 복구할 수 있습니다.",
            "status": "withdrawn_pending",
            "withdrawn_at": user.withdrawn_at.isoformat()
        })
    except Exception as e:
        db.session.rollback()
        from flask import current_app
        current_app.logger.error(f"Error requesting withdrawal for user {user.id}: {str(e)}")
        return jsonify({"message": "계정 탈퇴 처리 중 오류가 발생했습니다."}), 500


@user_bp.post("/me/cancel-deletion")
@jwt_required()
def cancel_account_deletion():
    user = user_query().get_or_404(int(get_jwt_identity()))
    
    if user.role != "pending_withdrawal" and user.status != "withdrawn_pending":
        return jsonify({"message": "탈퇴 대기 중인 계정이 아닙니다."}), 400
        
    try:
        user.role = "user"
        user.status = "active"
        user.deleted_at = None
        user.withdrawn_at = None
        db.session.commit()
        return jsonify({"message": "탈퇴가 성공적으로 철회되었습니다.", "user": user.to_dict(include_private=True)})
    except Exception as e:
        db.session.rollback()
        from flask import current_app
        current_app.logger.error(f"Error canceling deletion for user {user.id}: {str(e)}")
        return jsonify({"message": "탈퇴 철회 중 오류가 발생했습니다."}), 500



_verify_attempts = defaultdict(list)

def check_verify_rate_limit(user_id, max_attempts=5, period=60):
    now = time.time()
    attempts = [t for t in _verify_attempts[user_id] if now - t < period]
    _verify_attempts[user_id] = attempts
    if len(attempts) >= max_attempts:
        return False
    _verify_attempts[user_id].append(now)
    return True


@user_bp.post("/me/verify-password")
@jwt_required()
def verify_password():
    user_id = int(get_jwt_identity())
    if not check_verify_rate_limit(user_id):
        return jsonify({"message": "너무 많은 비밀번호 확인 시도가 있었습니다. 잠시 후 다시 시도해주세요."}), 429

    user = user_query().get_or_404(user_id)
    password = (request.get_json() or {}).get("password") or ""

    if not password:
        return jsonify({"message": "비밀번호를 입력해주세요."}), 400
    if "email" not in {item.strip() for item in (user.provider or "").split(",") if item.strip()}:
        return jsonify({"message": "이메일 로그인을 먼저 연동해주세요."}), 400

    if not user.password_hash or not user.check_password(password):
        return jsonify({"verified": False, "message": "비밀번호가 일치하지 않습니다."}), 400

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


def attach_schedule_sessions(meetings, include_cancelled=False):
    meeting_ids = sorted({meeting.id for meeting in meetings})
    sessions_by_meeting = {meeting_id: [] for meeting_id in meeting_ids}
    if meeting_ids:
        rows = (
            MeetingSession.query
            .filter(MeetingSession.meeting_id.in_(meeting_ids))
            .filter(MeetingSession.status.in_(["scheduled", "cancelled"]) if include_cancelled else MeetingSession.status == "scheduled")
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
    attendance_count = (
        Attendance.query
        .join(MeetingSession, Attendance.meeting_session_id == MeetingSession.id)
        .filter(
            Attendance.user_id == user_id,
            Attendance.meeting_session_id.isnot(None),
            Attendance.status == "present",
            MeetingSession.status != "cancelled",
            MeetingSession.start_at <= kst_now(),
        )
        .count()
    )
    hosted_items = meetings_for_user(user_id, hosted=True)
    joined_items = meetings_for_user(user_id, status="approved")
    pending_items = meetings_for_user(user_id, status="pending")
    unique_items = {meeting.id: meeting for meeting in [*hosted_items, *joined_items, *pending_items]}
    hydrated = {item["id"]: item for item in attach_schedule_sessions(unique_items.values())}
    hosted = [hydrated[meeting.id] for meeting in hosted_items]
    joined = [hydrated[meeting.id] for meeting in joined_items]
    pending = [hydrated[meeting.id] for meeting in pending_items]
    return jsonify({
        "hosted": hosted,
        "joined": joined,
        "pending": pending,
        "attendance_count": attendance_count,
    })


@user_bp.get("/me/attendance-history")
@jwt_required()
def my_attendance_history():
    user_id = int(get_jwt_identity())
    rows = (
        Attendance.query
        .join(MeetingSession, Attendance.meeting_session_id == MeetingSession.id)
        .options(joinedload(Attendance.meeting_session).joinedload(MeetingSession.meeting))
        .filter(
            Attendance.user_id == user_id,
            Attendance.status.in_(["present", "absent"]),
            MeetingSession.status != "cancelled",
            MeetingSession.start_at <= kst_now(),
        )
        .order_by(MeetingSession.start_at.desc())
        .all()
    )

    present_count = sum(row.status == "present" for row in rows)
    absent_count = sum(row.status == "absent" for row in rows)
    total_count = present_count + absent_count
    attendance_rate = round((present_count / total_count) * 100) if total_count else 0

    items = []
    for row in rows:
        session = row.meeting_session
        meeting = session.meeting if session else None
        items.append({
            "id": row.id,
            "status": row.status,
            "checked_at": row.checked_at.isoformat() if row.checked_at else None,
            "meeting": {
                "id": meeting.id,
                "title": meeting.title,
            } if meeting else None,
            "session": {
                "id": session.id,
                "session_number": session.session_number,
                "start_at": session.start_at.isoformat() if session.start_at else None,
                "end_at": session.end_at.isoformat() if session.end_at else None,
            } if session else None,
        })

    return jsonify({
        "summary": {
            "total_count": total_count,
            "present_count": present_count,
            "absent_count": absent_count,
            "attendance_rate": attendance_rate,
        },
        "items": items,
    })


@user_bp.get("/me/calendar")
@jwt_required()
def my_calendar():
    user_id = int(get_jwt_identity())
    hosted_items = meetings_for_user(user_id, hosted=True)
    joined_items = meetings_for_user(user_id, status="approved")
    unique_items = {meeting.id: meeting for meeting in [*hosted_items, *joined_items]}

    created_count = 0
    try:
        for meeting in unique_items.values():
            if meeting.meeting_type != "regular":
                continue
            result = ensure_regular_meeting_sessions(meeting)
            created_count += result.get("created_count", 0)
        if created_count:
            db.session.commit()
    except IntegrityError:
        db.session.rollback()
    except Exception:
        db.session.rollback()
        raise

    refreshed_items = {item["id"]: item for item in attach_schedule_sessions(unique_items.values(), include_cancelled=True)}
    hosted = [refreshed_items[meeting.id] for meeting in hosted_items]
    joined = [refreshed_items[meeting.id] for meeting in joined_items]
    return jsonify({"hosted": hosted, "joined": joined, "created_sessions_count": created_count})


@user_bp.get("/me/reviews")
@jwt_required()
def my_reviews():
    user_id = int(get_jwt_identity())
    
    # 내가 작성한 후기 (내가 남긴 후기)
    written = (
        Review.query
        .options(joinedload(Review.reviewer).joinedload(User.profile))
        .filter(Review.reviewer_id == user_id, Review.rating >= 0)
        .order_by(Review.created_at.desc())
        .limit(bounded_limit())
        .all()
    )
    
    # 나를 대상으로 남겨진 후기 (받은 후기)
    received = (
        Review.query
        .options(joinedload(Review.reviewer).joinedload(User.profile))
        .filter(Review.reviewee_id == user_id, Review.reviewer_id != user_id, Review.rating >= 0)
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
    review = Review.query.filter(Review.id == review_id, Review.rating >= 0).first_or_404()
    
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
    # 대상 유저(reviewee)가 평점의 주인이므로, 대상 유저의 프로필 평점을 다시 연산하여 반영합니다.
    reviewee = review.reviewee
    if reviewee and reviewee.profile:
        all_reviews = (
            Review.query
            .filter(Review.reviewee_id == reviewee.id)
            .filter(Review.reviewer_id != reviewee.id)
            .filter(Review.rating >= 0)
            .all()
        )
        
        if all_reviews:
            avg_rating = sum(r.rating for r in all_reviews) / len(all_reviews)
            reviewee.profile.rating_average = round(avg_rating, 2)
        else:
            reviewee.profile.rating_average = 0.0
            
        db.session.commit()
            
    return jsonify({"review": review.to_dict()})


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
    from app.services.meeting_service import ReviewNotFoundError, delete_review
    try:
        delete_review(review_id, user_id)
        return jsonify({"message": "후기가 삭제되었습니다."})
    except ReviewNotFoundError as e:
        return jsonify({"message": str(e)}), 404
    except PermissionError as e:
        return jsonify({"message": str(e)}), 403
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception:
        return jsonify({"message": "후기 삭제 중 오류가 발생했습니다."}), 500


@user_bp.get("/<int:user_id>")
def get_user(user_id):
    user = user_query().get_or_404(user_id)
    return jsonify({"user": user.to_dict()})
