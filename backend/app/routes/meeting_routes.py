from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import Attendance, ChatMessage, ChatRoom, Meeting, Notice, Participant, Review, Sport, User, Vote, VoteOption, VoteResponse
from app.services.meeting_service import close_expired_one_time_meetings, create_meeting, create_review, join_meeting, list_meetings, update_application, update_meeting

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


def parse_client_datetime(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo:
            parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed
    except ValueError:
        return None


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
    return jsonify({"items": [meeting.to_list_dict(current_user_id=current_user_id) for meeting in items]})


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
    if meeting.host:
        data["host_summary"] = host_summary(meeting.host)
    return jsonify({"meeting": data})


@meeting_bp.patch("/<int:meeting_id>")
@jwt_required()
def update(meeting_id):
    try:
        meeting = update_meeting(meeting_id, int(get_jwt_identity()), request.get_json() or {})
        return jsonify({"meeting": meeting.to_dict()})
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403


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
    participant.status = "cancelled"
    
    if original_status == "approved":
        meeting = participant.meeting
        if meeting:
            meeting.current_participants = max(1, meeting.current_participants - 1)
            meeting.sync_status()
            add_meeting_system_message(meeting, participant.user_id, f"{user_display_name(participant.user)}님이 나가셨습니다.")
            
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
    return jsonify({"items": [item.to_dict() for item in items]})


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
    if meeting.status == "suspended":
        return jsonify({"message": "폐쇄(비활성화) 처리된 모임입니다."}), 400
    if meeting.host_id != user_id and not can_manage_meeting_tools(meeting_id, user_id):
        return jsonify({"message": "방장만 공지를 작성할 수 있습니다."}), 403
    data = request.get_json() or {}
    notice = Notice(
        meeting_id=meeting_id,
        title=data.get("title", ""),
        content=data.get("content", ""),
        is_pinned=data.get("is_pinned", False)
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


@meeting_bp.delete("/<int:meeting_id>/members/<int:user_id>")
@jwt_required()
def kick_member(meeting_id, user_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    current_user_id = int(get_jwt_identity())
    if meeting.host_id != current_user_id:
        return jsonify({"message": "방장만 멤버를 추방할 수 있습니다."}), 403
    if meeting.host_id == user_id:
        return jsonify({"message": "방장은 추방할 수 없습니다."}), 400
    participant = Participant.query.filter_by(meeting_id=meeting_id, user_id=user_id, status="approved").first_or_404()
    participant.status = "kicked"
    meeting.current_participants = max(1, int(meeting.current_participants or 1) - 1)
    meeting.sync_status()
    add_meeting_system_message(meeting, current_user_id, f"{user_display_name(participant.user)}님이 추방되셨습니다.")
    db.session.commit()
    return jsonify({"participant": participant.to_dict(), "meeting": meeting.to_dict(current_user_id=current_user_id)})


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
    rows = (
        Attendance.query
        .options(joinedload(Attendance.user).joinedload(User.profile))
        .filter_by(meeting_id=meeting_id)
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
        "approved_participants": [row.to_dict() for row in approved]
    })


@meeting_bp.post("/<int:meeting_id>/attendance/check")
@jwt_required()
def check_attendance(meeting_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    if meeting.status == "suspended":
        return jsonify({"message": "폐쇄(비활성화) 처리된 모임입니다."}), 400
    current_user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    target_user_id = int(data.get("user_id") or current_user_id)
    is_host = meeting.host_id == current_user_id
    participant = Participant.query.filter_by(meeting_id=meeting_id, user_id=target_user_id, status="approved").first()
    if not participant and not is_host:
        return jsonify({"message": "승인된 참여자만 출석 체크할 수 있습니다."}), 403
    if target_user_id != current_user_id and not is_host:
        return jsonify({"message": "방장만 다른 참여자의 출석을 체크할 수 있습니다."}), 403
    if not participant and is_host and target_user_id != current_user_id:
        return jsonify({"message": "승인된 참여자만 출석 체크할 수 있습니다."}), 400
    row = Attendance.query.filter_by(meeting_id=meeting_id, user_id=target_user_id).first()
    if not row:
        row = Attendance(meeting_id=meeting_id, user_id=target_user_id, status="present")
        db.session.add(row)
    db.session.commit()
    return jsonify({"attendance": row.to_dict()})
