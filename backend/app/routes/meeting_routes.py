import hashlib
import secrets
from datetime import timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import Attendance, ChatMessage, ChatRoom, Meeting, MeetingSession, Notice, Participant, Review, Sport, User, Vote, VoteOption, VoteResponse
from app.services.meeting_service import cancel_meeting_session, close_expired_one_time_meetings, create_meeting, create_review, get_next_meeting_session, join_meeting, kick_meeting_member, list_meeting_members, list_meeting_sessions, list_meetings, recalculate_current_participants, update_application, update_meeting, update_meeting_session
from app.utils.meeting_state import is_meeting_operation_ended, meeting_chat_is_read_only
from app.utils.timezone import kst_now, parse_client_datetime

meeting_bp = Blueprint("meetings", __name__)


@meeting_bp.get("/config")
def get_meeting_config():
    from app.utils.settings import load_system_settings
    settings = load_system_settings()
    return jsonify({
        "defaultMaxParticipants": settings.get("defaultMaxParticipants", 6)
    })


def current_user_id_optional():
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        return int(identity) if identity else None
    except Exception:
        return None


def can_manage_meeting_tools(meeting_id, user_id):
    participant = Participant.query.filter_by(meeting_id=meeting_id, user_id=user_id, status="approved").first()
    return bool(participant and participant.role in ["host", "cohost", "subhost", "assistant"])


def user_display_name(user):
    return (user.nickname or user.name) if user else "참여자"


def add_meeting_system_message(meeting, user_id, content):
    chat_room = meeting.chat_room or ChatRoom(meeting_id=meeting.id)
    if not meeting.chat_room:
        db.session.add(chat_room)
        db.session.flush()
    db.session.add(ChatMessage(
        chat_room_id=chat_room.id,
        user_id=user_id,
        content=content,
        message_type="system",
    ))


def host_summary(host):
    profile = host.profile
    hosted_query = Meeting.query.filter(Meeting.host_id == host.id)
    review_count = (
        Review.query
        .join(Meeting, Review.meeting_id == Meeting.id)
        .filter(Meeting.host_id == host.id)
        .count()
    )
    return {
        "rating_average": round(profile.rating_average, 1) if profile else 0,
        "attendance_rate": int(profile.attendance_rate) if profile else 0,
        "hosted_count": hosted_query.count(),
        "active_hosted_count": hosted_query.filter(Meeting.status == "open").count(),
        "completed_hosted_count": hosted_query.filter(Meeting.status == "closed").count(),
        "review_count": review_count,
        "region": profile.region if profile else "",
        "exercise_level": profile.exercise_level if profile else "",
        "preferred_sports": profile.preferred_sports if profile else "",
        "bio": profile.bio if profile else "",
    }


@meeting_bp.get("")
def index():
    current_user_id = current_user_id_optional()
    items = list_meetings(request.args, current_user_id)
    response_items = []
    for meeting in items:
        data = meeting.to_list_dict(current_user_id=current_user_id)
        next_session = get_next_meeting_session(meeting.id) if meeting.meeting_type == "regular" else None
        data["next_session"] = next_session.to_dict() if next_session else None
        response_items.append(data)
    return jsonify({"items": response_items})


@meeting_bp.post("")
@jwt_required()
def create():
    try:
        meeting = create_meeting(request.get_json() or {}, int(get_jwt_identity()))
        return jsonify({"meeting": meeting.to_dict()}), 201
    except ValueError as error:
        return jsonify({"message": str(error)}), 400


@meeting_bp.get("/<int:meeting_id>")
def show(meeting_id):
    close_expired_one_time_meetings()
    current_user_id = current_user_id_optional()
    meeting = Meeting.query.options(
        joinedload(Meeting.host).joinedload(User.profile),
        joinedload(Meeting.sport).joinedload(Sport.category),
        joinedload(Meeting.participants),
        joinedload(Meeting.chat_room),
    ).get_or_404(meeting_id)
    meeting.view_count += 1
    db.session.commit()
    data = meeting.to_dict(current_user_id=current_user_id)
    next_session = get_next_meeting_session(meeting.id) if meeting.meeting_type == "regular" else None
    data["next_session"] = next_session.to_dict() if next_session else None
    if meeting.host:
        data["host_summary"] = host_summary(meeting.host)
    return jsonify({"meeting": data})


@meeting_bp.get("/<int:meeting_id>/sessions")
def sessions(meeting_id):
    items = list_meeting_sessions(meeting_id)
    return jsonify({"items": [item.to_dict() for item in items]})


@meeting_bp.patch("/<int:meeting_id>/sessions/<int:session_id>")
@jwt_required()
def patch_session(meeting_id, session_id):
    try:
        item = update_meeting_session(
            meeting_id,
            session_id,
            int(get_jwt_identity()),
            request.get_json() or {},
        )
        return jsonify({"message": "일정이 변경되었습니다.", "item": item.to_dict()})
    except LookupError as error:
        return jsonify({"message": str(error)}), 404
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403
    except ValueError as error:
        return jsonify({"message": str(error)}), 400


@meeting_bp.patch("/<int:meeting_id>/sessions/<int:session_id>/cancel")
@jwt_required()
def cancel_session(meeting_id, session_id):
    try:
        item = cancel_meeting_session(
            meeting_id,
            session_id,
            int(get_jwt_identity()),
            (request.get_json() or {}).get("reason"),
        )
        return jsonify({"message": "일정이 취소되었습니다.", "item": item.to_dict()})
    except LookupError as error:
        return jsonify({"message": str(error)}), 404
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403
    except ValueError as error:
        return jsonify({"message": str(error)}), 400


@meeting_bp.patch("/<int:meeting_id>")
@jwt_required()
def update(meeting_id):
    try:
        meeting = update_meeting(meeting_id, int(get_jwt_identity()), request.get_json() or {})
        return jsonify({"meeting": meeting.to_dict()})
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403
    except ValueError as error:
        return jsonify({"message": str(error)}), 400


@meeting_bp.delete("/<int:meeting_id>")
@jwt_required()
def delete(meeting_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    if meeting.host_id != int(get_jwt_identity()):
        return jsonify({"message": "방장만 취소할 수 있습니다."}), 403
    meeting.status = "cancelled"
    from app.extensions import db
    db.session.commit()
    return jsonify({"meeting": meeting.to_dict()})


@meeting_bp.post("/<int:meeting_id>/join")
@jwt_required()
def join(meeting_id):
    try:
        participant = join_meeting(meeting_id, int(get_jwt_identity()), (request.get_json() or {}).get("join_message", ""))
        return jsonify({"participant": participant.to_dict(), "meeting": participant.meeting.to_dict(current_user_id=participant.user_id)}), 201
    except ValueError as error:
        return jsonify({"message": str(error)}), 400


@meeting_bp.delete("/<int:meeting_id>/join")
@jwt_required()
def cancel_join(meeting_id):
    participant = Participant.query.filter_by(meeting_id=meeting_id, user_id=int(get_jwt_identity())).first_or_404()
    original_status = participant.status

    if participant.meeting and (participant.meeting.host_id == participant.user_id or participant.role == "host"):
        return jsonify({"message": "방장은 모임에서 나갈 수 없습니다."}), 400

    if original_status not in {"pending", "approved"}:
        return jsonify({"message": "취소할 수 없는 참여 상태입니다."}), 400

    if original_status == "approved":
        meeting = participant.meeting
        if meeting:
            if meeting.status == "cancelled":
                return jsonify({"message": "취소된 모임에서는 나갈 수 없습니다."}), 400
            if meeting.status == "suspended":
                return jsonify({"message": "운영 중지된 모임에서는 나갈 수 없습니다."}), 400
            if is_meeting_operation_ended(meeting):
                return jsonify({"message": "종료된 모임에서는 나갈 수 없습니다."}), 400
            participant.status = "cancelled"
            recalculate_current_participants(meeting)
            add_meeting_system_message(meeting, participant.user_id, f"{user_display_name(participant.user)}님이 나가셨습니다.")
    else:
        participant.status = "cancelled"

    db.session.commit()
    return jsonify({"participant": participant.to_dict()})


@meeting_bp.get("/<int:meeting_id>/applicants")
@jwt_required()
def applicants(meeting_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    if meeting.host_id != int(get_jwt_identity()):
        return jsonify({"message": "방장만 조회할 수 있습니다."}), 403
    items = (
        Participant.query
        .options(
            joinedload(Participant.user).joinedload(User.profile),
            joinedload(Participant.meeting).joinedload(Meeting.host).joinedload(User.profile),
            joinedload(Participant.meeting).joinedload(Meeting.sport).joinedload(Sport.category),
            joinedload(Participant.meeting).joinedload(Meeting.chat_room),
        )
        .filter_by(meeting_id=meeting_id, status="pending")
        .all()
    )
    item_data = []
    for item in items:
        data = item.to_dict()
        data["requested_at"] = item.requested_at.isoformat() if item.requested_at else None
        item_data.append(data)
    return jsonify({"items": item_data, "count": len(item_data)})


@meeting_bp.patch("/<int:meeting_id>/applicants/<int:user_id>/approve")
@jwt_required()
def approve(meeting_id, user_id):
    try:
        participant = update_application(meeting_id, user_id, int(get_jwt_identity()), "approved")
        return jsonify({"participant": participant.to_dict()})
    except (ValueError, PermissionError) as error:
        return jsonify({"message": str(error)}), 400


@meeting_bp.patch("/<int:meeting_id>/applicants/<int:user_id>/reject")
@jwt_required()
def reject(meeting_id, user_id):
    try:
        participant = update_application(meeting_id, user_id, int(get_jwt_identity()), "rejected")
        return jsonify({"participant": participant.to_dict()})
    except (ValueError, PermissionError) as error:
        return jsonify({"message": str(error)}), 400


@meeting_bp.get("/<int:meeting_id>/reviews")
def reviews(meeting_id):
    items = Review.query.options(joinedload(Review.reviewer).joinedload(User.profile)).filter_by(meeting_id=meeting_id).order_by(Review.created_at.desc()).all()
    return jsonify({"items": [item.to_dict() for item in items]})


@meeting_bp.post("/<int:meeting_id>/reviews")
@jwt_required()
def post_review(meeting_id):
    try:
        review = create_review(meeting_id, int(get_jwt_identity()), request.get_json() or {})
        return jsonify({"review": review.to_dict()}), 201
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403


@meeting_bp.get("/<int:meeting_id>/notices")
def notices(meeting_id):
    Meeting.query.get_or_404(meeting_id)
    items = Notice.query.filter_by(meeting_id=meeting_id).order_by(Notice.is_pinned.desc(), Notice.created_at.desc()).all()
    return jsonify({"items": [item.to_dict() for item in items]})


@meeting_bp.post("/<int:meeting_id>/notices")
@jwt_required()
def post_notice(meeting_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    user_id = int(get_jwt_identity())
    if meeting_chat_is_read_only(meeting):
        return jsonify({"message": "마감된 모임에서는 공지를 새로 등록할 수 없습니다."}), 403
    if meeting.status == "suspended":
        return jsonify({"message": "폐쇄(비활성화) 처리된 모임입니다."}), 400
    if meeting.host_id != user_id and not can_manage_meeting_tools(meeting_id, user_id):
        return jsonify({"message": "방장만 공지를 작성할 수 있습니다."}), 403
    data = request.get_json() or {}
    notice_type = data.get("notice_type") if data.get("notice_type") in {"text", "vote", "schedule"} else "text"
    vote_id = int(data["vote_id"]) if data.get("vote_id") else None
    session_id = int(data["session_id"]) if data.get("session_id") else None
    if notice_type == "vote":
        vote = Vote.query.filter_by(id=vote_id, meeting_id=meeting_id).first() if vote_id else None
        if not vote:
            return jsonify({"message": "연결할 투표를 찾을 수 없습니다."}), 400
    if notice_type == "schedule":
        session = MeetingSession.query.filter_by(id=session_id, meeting_id=meeting_id).first() if session_id else None
        if not session and meeting.meeting_type == "regular":
            return jsonify({"message": "연결할 일정을 찾을 수 없습니다."}), 400
        if meeting.meeting_type != "regular":
            session_id = None
    notice = Notice(
        meeting_id=meeting_id,
        title=data.get("title", ""),
        content=data.get("content", ""),
        is_pinned=data.get("is_pinned", False),
        notice_type=notice_type,
        vote_id=vote_id if notice_type == "vote" else None,
        session_id=session_id if notice_type == "schedule" else None
    )
    db.session.add(notice)
    chat_room = meeting.chat_room or ChatRoom(meeting_id=meeting.id)
    if not meeting.chat_room:
        db.session.add(chat_room)
        db.session.flush()
    db.session.add(ChatMessage(
        chat_room_id=chat_room.id,
        user_id=user_id,
        content=f"공지가 등록되었습니다: {notice.content}",
        message_type="notice",
    ))
    db.session.commit()
    return jsonify({"notice": notice.to_dict()}), 201


@meeting_bp.get("/<int:meeting_id>/members")
@jwt_required()
def members(meeting_id):
    try:
        items = list_meeting_members(meeting_id, int(get_jwt_identity()))
        return jsonify({"items": items, "count": len(items)})
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403


@meeting_bp.delete("/<int:meeting_id>/members/<int:user_id>")
@jwt_required()
def kick_member(meeting_id, user_id):
    current_user_id = int(get_jwt_identity())
    try:
        participant, meeting = kick_meeting_member(meeting_id, user_id, current_user_id)
        return jsonify({"participant": participant.to_dict(), "meeting": meeting.to_dict(current_user_id=current_user_id)})
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403
    except ValueError as error:
        return jsonify({"message": str(error)}), 400


@meeting_bp.get("/<int:meeting_id>/votes")
def votes(meeting_id):
    Meeting.query.get_or_404(meeting_id)
    current_user_id = current_user_id_optional()
    items = Vote.query.options(joinedload(Vote.options)).filter_by(meeting_id=meeting_id).order_by(Vote.created_at.desc()).all()
    option_ids = [option.id for item in items for option in item.options]
    response_counts = {}
    if option_ids:
        response_counts = dict(
            db.session.query(VoteResponse.option_id, func.count(VoteResponse.id))
            .filter(VoteResponse.option_id.in_(option_ids))
            .group_by(VoteResponse.option_id)
            .all()
        )
    selected_options = {}
    if current_user_id and items:
        selected_rows = (
            db.session.query(VoteResponse.vote_id, VoteResponse.option_id)
            .filter(VoteResponse.vote_id.in_([item.id for item in items]))
            .filter(VoteResponse.user_id == current_user_id)
            .all()
        )
        for vote_id, option_id in selected_rows:
            selected_options.setdefault(vote_id, []).append(option_id)
    voter_map = {}
    if items:
        voter_rows = (
            db.session.query(VoteResponse.vote_id, VoteResponse.option_id, User.id, User.name, User.nickname, User.user_tag)
            .join(User, User.id == VoteResponse.user_id)
            .filter(VoteResponse.vote_id.in_([item.id for item in items]))
            .all()
        )
        for vote_id, option_id, user_id, name, nickname, user_tag in voter_rows:
            voter_map.setdefault(vote_id, {}).setdefault(option_id, []).append({
                "id": user_id,
                "name": name,
                "nickname": nickname,
                "user_tag": user_tag,
            })
    result = []
    for item in items:
        data = item.to_dict(response_counts)
        selected_ids = selected_options.get(item.id, [])
        data["selected_option_ids"] = selected_ids
        data["selected_option_id"] = selected_ids[0] if selected_ids else None
        if not item.is_anonymous:
            for option in data["options"]:
                option["voters"] = voter_map.get(item.id, {}).get(option["id"], [])
        result.append(data)
    return jsonify({"items": result})


@meeting_bp.post("/<int:meeting_id>/votes")
@jwt_required()
def post_vote(meeting_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    if meeting_chat_is_read_only(meeting):
        return jsonify({"message": "마감된 모임에서는 투표를 새로 만들 수 없습니다."}), 403
    if meeting.status == "suspended":
        return jsonify({"message": "폐쇄(비활성화) 처리된 모임입니다."}), 400
    user_id = int(get_jwt_identity())
    if meeting.host_id != user_id and not can_manage_meeting_tools(meeting_id, user_id):
        return jsonify({"message": "모임 운영진만 투표를 생성할 수 있습니다."}), 403
    data = request.get_json() or {}
    vote = Vote(
        meeting_id=meeting_id,
        title=data.get("title", ""),
        ends_at=parse_client_datetime(data.get("ends_at")),
        allow_multiple=bool(data.get("allow_multiple", False)),
        is_anonymous=bool(data.get("is_anonymous", True)),
    )
    db.session.add(vote)
    db.session.flush()
    for option_text in data.get("options", []):
        if option_text:
            db.session.add(VoteOption(vote_id=vote.id, text=option_text))
    
    chat_room = meeting.chat_room or ChatRoom(meeting_id=meeting.id)
    if not meeting.chat_room:
        db.session.add(chat_room)
        db.session.flush()
    db.session.add(ChatMessage(
        chat_room_id=chat_room.id,
        user_id=user_id,
        content=f"새로운 투표가 등록되었습니다: {vote.title}",
        message_type="notice",
    ))
    
    db.session.commit()
    return jsonify({"vote": vote.to_dict()}), 201


@meeting_bp.get("/<int:meeting_id>/attendance")
@jwt_required()
def attendance(meeting_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    user_id = int(get_jwt_identity())
    is_host = meeting.host_id == user_id
    is_participant = Participant.query.filter_by(meeting_id=meeting_id, user_id=user_id, status="approved").first()
    if not is_host and not is_participant:
        return jsonify({"message": "승인된 참여자만 출석 정보를 볼 수 있습니다."}), 403
    try:
        selected_session, sessions, past_sessions = resolve_attendance_session(meeting, request.args.get("session_id"))
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
    rows = (
        Attendance.query
        .options(joinedload(Attendance.user).joinedload(User.profile))
        .filter_by(
            meeting_id=meeting_id,
            meeting_session_id=selected_session.id if selected_session else None,
        )
        .all()
    )
    approved = (
        Participant.query
        .options(
            joinedload(Participant.user).joinedload(User.profile),
            joinedload(Participant.meeting).joinedload(Meeting.host).joinedload(User.profile),
            joinedload(Participant.meeting).joinedload(Meeting.sport).joinedload(Sport.category),
            joinedload(Participant.meeting).joinedload(Meeting.chat_room),
        )
        .filter_by(meeting_id=meeting_id, status="approved")
        .all()
    )
    return jsonify({
        "items": [row.to_dict() for row in rows],
        "approved_participants": [row.to_dict() for row in approved],
        "sessions": [row.to_dict() for row in sessions],
        "past_sessions": [row.to_dict() for row in past_sessions],
        "selected_session": selected_session.to_dict() if selected_session else None,
    })


def resolve_attendance_session(meeting, requested_session_id=None):
    sessions = (
        MeetingSession.query
        .filter_by(meeting_id=meeting.id)
        .order_by(MeetingSession.start_at.asc(), MeetingSession.id.asc())
        .all()
    )
    today = kst_now().date()
    next_monday = today + timedelta(days=7 - today.weekday())
    current_sessions = [
        item
        for item in sessions
        if item.status != "cancelled"
        and today <= item.start_at.date() < next_monday
    ]
    past_sessions = [
        item
        for item in reversed(sessions)
        if item.status != "cancelled" and item.start_at.date() < today
    ]
    if requested_session_id not in (None, ""):
        try:
            session_id = int(requested_session_id)
        except (TypeError, ValueError) as error:
            raise ValueError("올바른 모임 회차를 선택해 주세요.") from error
        selected = next((item for item in sessions if item.id == session_id), None)
        if not selected:
            raise ValueError("해당 모임의 회차를 찾을 수 없습니다.")
        if selected not in current_sessions and selected not in past_sessions:
            raise ValueError("다음 주 이후 회차는 해당 주 월요일부터 출석 체크할 수 있습니다.")
        return selected, current_sessions, past_sessions

    if not current_sessions:
        return None, current_sessions, past_sessions
    return current_sessions[0], current_sessions, past_sessions


def refresh_user_attendance_rate(user_id):
    decided = Attendance.query.filter(
        Attendance.user_id == user_id,
        Attendance.meeting_session_id.isnot(None),
        Attendance.status.in_(["present", "absent"]),
    )
    total_count = decided.count()
    present_count = decided.filter(Attendance.status == "present").count()
    rate = round((present_count / total_count) * 100, 1) if total_count else 0.0
    user = User.query.get(user_id)
    if user and user.profile:
        user.profile.attendance_rate = rate
    return rate


@meeting_bp.post("/<int:meeting_id>/attendance/check")
@jwt_required()
def check_attendance(meeting_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    if meeting.status == "suspended":
        return jsonify({"message": "폐쇄(비활성화) 처리된 모임입니다."}), 400
    current_user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    target_user_id = int(data.get("user_id") or current_user_id)
    try:
        selected_session, _, _ = resolve_attendance_session(meeting, data.get("session_id"))
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
    if not selected_session:
        return jsonify({"message": "출석을 기록할 수 있는 모임 회차가 없습니다."}), 400
    status_value = data.get("status") or "present"
    if not isinstance(status_value, str):
        return jsonify({"message": "출석 상태는 문자열이어야 합니다."}), 400
    status = status_value.strip().lower()
    if status not in {"present", "absent"}:
        return jsonify({"message": "출석 상태는 present 또는 absent만 사용할 수 있습니다."}), 400
    is_host = meeting.host_id == current_user_id
    participant = Participant.query.filter_by(meeting_id=meeting_id, user_id=target_user_id, status="approved").first()
    if not participant and not is_host:
        return jsonify({"message": "승인된 참여자만 출석 체크할 수 있습니다."}), 403
    if target_user_id != current_user_id and not is_host:
        return jsonify({"message": "방장만 다른 참여자의 출석을 체크할 수 있습니다."}), 403
    if not participant and is_host and target_user_id != current_user_id:
        return jsonify({"message": "승인된 참여자만 출석 체크할 수 있습니다."}), 400
    row = Attendance.query.filter_by(
        meeting_id=meeting_id,
        meeting_session_id=selected_session.id,
        user_id=target_user_id,
    ).first()
    if not row:
        row = Attendance(
            meeting_id=meeting_id,
            meeting_session_id=selected_session.id,
            user_id=target_user_id,
            status=status,
        )
        db.session.add(row)
    else:
        row.status = status
        row.checked_at = kst_now()
    db.session.flush()
    attendance_rate = refresh_user_attendance_rate(target_user_id)
    db.session.commit()
    return jsonify({
        "attendance": row.to_dict(),
        "attendance_rate": attendance_rate,
        "session": selected_session.to_dict(),
    })


def checkin_token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@meeting_bp.post("/<int:meeting_id>/attendance/checkin-window")
@jwt_required()
def create_attendance_checkin_window(meeting_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    current_user_id = int(get_jwt_identity())
    if meeting.host_id != current_user_id:
        return jsonify({"message": "방장만 QR 체크인을 시작할 수 있습니다."}), 403
    data = request.get_json(silent=True) or {}
    try:
        selected_session, _, _ = resolve_attendance_session(meeting, data.get("session_id"))
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
    if not selected_session:
        return jsonify({"message": "QR을 생성할 회차를 선택해 주세요."}), 400

    now = kst_now()
    opens_at = now
    closes_at = selected_session.start_at + timedelta(minutes=30)
    if now >= closes_at:
        return jsonify({"message": "모임 시작 후 30분이 지나 QR 체크인이 종료되었습니다."}), 400

    AttendanceCheckinWindow.query.filter_by(
        meeting_session_id=selected_session.id,
        is_active=True,
    ).update({"is_active": False}, synchronize_session=False)
    token = secrets.token_urlsafe(32)
    window = AttendanceCheckinWindow(
        meeting_session_id=selected_session.id,
        created_by=current_user_id,
        token_hash=checkin_token_hash(token),
        opens_at=opens_at,
        closes_at=closes_at,
        is_active=True,
    )
    db.session.add(window)
    db.session.commit()
    return jsonify({
        "token": token,
        "window": window.to_dict(),
        "session": selected_session.to_dict(),
    }), 201


@meeting_bp.post("/attendance/checkin/<string:token>")
@jwt_required()
def attendance_qr_checkin(token):
    window = (
        AttendanceCheckinWindow.query
        .options(joinedload(AttendanceCheckinWindow.meeting_session).joinedload(MeetingSession.meeting))
        .filter_by(token_hash=checkin_token_hash(token), is_active=True)
        .first()
    )
    if not window:
        return jsonify({"message": "유효하지 않거나 새로 발급된 QR 코드로 교체된 링크입니다."}), 404

    now = kst_now()
    if now < window.opens_at:
        return jsonify({"message": "QR 체크인 시작 전입니다. 방장에게 새 QR 생성을 요청해 주세요."}), 400
    if now >= window.closes_at:
        window.is_active = False
        db.session.commit()
        return jsonify({"message": "모임 시작 후 30분이 지나 QR 체크인이 종료되었습니다."}), 410

    session = window.meeting_session
    meeting = session.meeting
    user_id = int(get_jwt_identity())
    participant = Participant.query.filter_by(
        meeting_id=meeting.id,
        user_id=user_id,
        status="approved",
    ).first()
    if not participant:
        return jsonify({"message": "승인된 모임 참여자만 QR 체크인할 수 있습니다."}), 403

    attendance_row = Attendance.query.filter_by(
        meeting_id=meeting.id,
        meeting_session_id=session.id,
        user_id=user_id,
    ).first()
    already_checked_in = bool(attendance_row and attendance_row.status == "present")
    if not attendance_row:
        attendance_row = Attendance(
            meeting_id=meeting.id,
            meeting_session_id=session.id,
            user_id=user_id,
            status="present",
        )
        db.session.add(attendance_row)
    else:
        attendance_row.status = "present"
        attendance_row.checked_at = now
    db.session.flush()
    attendance_rate = refresh_user_attendance_rate(user_id)
    db.session.commit()
    return jsonify({
        "message": "이미 출석 체크된 회차입니다." if already_checked_in else "QR 출석 체크가 완료되었습니다.",
        "already_checked_in": already_checked_in,
        "attendance": attendance_row.to_dict(),
        "attendance_rate": attendance_rate,
        "meeting": {"id": meeting.id, "title": meeting.title},
        "session": session.to_dict(),
    })


@meeting_bp.delete("/<int:meeting_id>/notices/<int:notice_id>")
@jwt_required()
def delete_notice(meeting_id, notice_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    user_id = int(get_jwt_identity())
    if meeting_chat_is_read_only(meeting):
        return jsonify({"message": "마감된 모임에서는 공지를 삭제할 수 없습니다."}), 403
    if meeting.status == "suspended":
        return jsonify({"message": "폐쇄(비활성화) 처리된 모임입니다."}), 400
    if meeting.host_id != user_id and not can_manage_meeting_tools(meeting_id, user_id):
        return jsonify({"message": "방장만 공지를 삭제할 수 있습니다."}), 403
    notice = Notice.query.filter_by(meeting_id=meeting_id, id=notice_id).first_or_404()
    
    # Update the corresponding ChatMessage
    chat_room = meeting.chat_room
    if chat_room:
        msg = ChatMessage.query.filter_by(chat_room_id=chat_room.id, message_type="notice").filter(
            ChatMessage.content.like(f"공지가 등록되었습니다: {notice.content}%")
        ).first()
        if msg:
            msg.content = "삭제된 공지입니다."
            
    db.session.delete(notice)
    db.session.commit()
    return jsonify({"message": "공지가 삭제되었습니다."}), 200


@meeting_bp.delete("/<int:meeting_id>/votes/<int:vote_id>")
@jwt_required()
def delete_vote(meeting_id, vote_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    user_id = int(get_jwt_identity())
    if meeting_chat_is_read_only(meeting):
        return jsonify({"message": "마감된 모임에서는 투표를 삭제할 수 없습니다."}), 403
    if meeting.status == "suspended":
        return jsonify({"message": "폐쇄(비활성화) 처리된 모임입니다."}), 400
    if meeting.host_id != user_id and not can_manage_meeting_tools(meeting_id, user_id):
        return jsonify({"message": "모임 운영진만 투표를 삭제할 수 있습니다."}), 403
    vote = Vote.query.filter_by(meeting_id=meeting_id, id=vote_id).first_or_404()
    
    # Update the corresponding ChatMessage
    chat_room = meeting.chat_room
    if chat_room:
        msg = ChatMessage.query.filter_by(chat_room_id=chat_room.id, message_type="notice").filter(
            ChatMessage.content.like(f"새로운 투표가 등록되었습니다: {vote.title}%")
        ).first()
        if msg:
            msg.content = "삭제된 투표입니다."
            
    # Delete responses first to avoid foreign key constraint violations
    VoteResponse.query.filter_by(vote_id=vote_id).delete()
    db.session.delete(vote)
    db.session.commit()
    return jsonify({"message": "투표가 삭제되었습니다."}), 200
