from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request

from app.extensions import db
from app.models import Attendance, Meeting, Notice, Participant, Review, Vote, VoteOption
from app.services.meeting_service import create_meeting, create_review, join_meeting, list_meetings, update_application, update_meeting

meeting_bp = Blueprint("meetings", __name__)


def current_user_id_optional():
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        return int(identity) if identity else None
    except Exception:
        return None


@meeting_bp.get("")
def index():
    items = list_meetings(request.args, current_user_id_optional())
    return jsonify({"items": [meeting.to_dict() for meeting in items]})


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
    meeting = Meeting.query.get_or_404(meeting_id)
    meeting.view_count += 1
    db.session.commit()
    return jsonify({"meeting": meeting.to_dict()})


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
        return jsonify({"participant": participant.to_dict()}), 201
    except ValueError as error:
        return jsonify({"message": str(error)}), 400


@meeting_bp.delete("/<int:meeting_id>/join")
@jwt_required()
def cancel_join(meeting_id):
    participant = Participant.query.filter_by(meeting_id=meeting_id, user_id=int(get_jwt_identity())).first_or_404()
    participant.status = "cancelled"
    db.session.commit()
    return jsonify({"participant": participant.to_dict()})


@meeting_bp.get("/<int:meeting_id>/applicants")
@jwt_required()
def applicants(meeting_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    if meeting.host_id != int(get_jwt_identity()):
        return jsonify({"message": "방장만 조회할 수 있습니다."}), 403
    items = Participant.query.filter_by(meeting_id=meeting_id, status="pending").all()
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
    items = Review.query.filter_by(meeting_id=meeting_id).order_by(Review.created_at.desc()).all()
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
    if meeting.host_id != int(get_jwt_identity()):
        return jsonify({"message": "방장만 공지를 작성할 수 있습니다."}), 403
    data = request.get_json() or {}
    notice = Notice(
        meeting_id=meeting_id,
        title=data.get("title", ""),
        content=data.get("content", ""),
        is_pinned=data.get("is_pinned", False)
    )
    db.session.add(notice)
    db.session.commit()
    return jsonify({"notice": notice.to_dict()}), 201


@meeting_bp.get("/<int:meeting_id>/votes")
def votes(meeting_id):
    Meeting.query.get_or_404(meeting_id)
    items = Vote.query.filter_by(meeting_id=meeting_id).order_by(Vote.created_at.desc()).all()
    return jsonify({"items": [item.to_dict() for item in items]})


@meeting_bp.post("/<int:meeting_id>/votes")
@jwt_required()
def post_vote(meeting_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    if meeting.host_id != int(get_jwt_identity()):
        return jsonify({"message": "방장만 투표를 생성할 수 있습니다."}), 403
    data = request.get_json() or {}
    vote = Vote(meeting_id=meeting_id, title=data.get("title", ""))
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
    rows = Attendance.query.filter_by(meeting_id=meeting_id).all()
    approved = Participant.query.filter_by(meeting_id=meeting_id, status="approved").all()
    return jsonify({
        "items": [row.to_dict() for row in rows],
        "approved_participants": [row.to_dict() for row in approved]
    })


@meeting_bp.post("/<int:meeting_id>/attendance/check")
@jwt_required()
def check_attendance(meeting_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    user_id = int(get_jwt_identity())
    participant = Participant.query.filter_by(meeting_id=meeting_id, user_id=user_id, status="approved").first()
    if not participant and meeting.host_id != user_id:
        return jsonify({"message": "승인된 참여자만 출석 체크할 수 있습니다."}), 403
    row = Attendance.query.filter_by(meeting_id=meeting_id, user_id=user_id).first()
    if not row:
        row = Attendance(meeting_id=meeting_id, user_id=user_id, status="present")
        db.session.add(row)
    db.session.commit()
    return jsonify({"attendance": row.to_dict()})
