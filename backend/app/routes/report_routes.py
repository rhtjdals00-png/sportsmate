import json

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models import ChatRoom, Meeting, Report, User
from app.services.chat_service import ensure_chat_access
from app.services.notification_service import create_notification

report_bp = Blueprint("reports", __name__)

ALLOWED_TARGET_TYPES = {"meeting", "chat_room", "user"}


def duplicate_report_message(target_type):
    if target_type == "user":
        return "이미 신고한 유저입니다."
    if target_type == "chat_room":
        return "이미 신고한 방입니다."
    if target_type == "meeting":
        return "이미 신고한 모임입니다."
    return "이미 신고한 대상입니다."


@report_bp.post("")
@jwt_required()
def create_report():
    data = request.get_json() or {}
    reporter_id = int(get_jwt_identity())
    target_type = data.get("target_type", "meeting")
    if target_type not in ALLOWED_TARGET_TYPES:
        return jsonify({"message": "지원하지 않는 신고 대상입니다."}), 400

    try:
        target_id = int(data.get("target_id"))
    except (TypeError, ValueError):
        return jsonify({"message": "신고 대상을 확인할 수 없습니다."}), 400

    reason = (data.get("reason") or "기타").strip()
    reason_detail = (data.get("reason_detail") or data.get("detail") or "").strip()
    if len(reason_detail) < 5:
        return jsonify({"message": "신고 사유를 조금 더 자세히 입력해주세요."}), 400

    if target_type == "user":
        if target_id == reporter_id:
            return jsonify({"message": "본인은 신고할 수 없습니다."}), 400
        if not User.query.get(target_id):
            return jsonify({"message": "신고할 회원을 찾지 못했습니다."}), 404
    elif target_type == "meeting":
        meeting = Meeting.query.get(target_id)
        if not meeting:
            return jsonify({"message": "신고할 모임을 찾지 못했습니다."}), 404
        if meeting.host_id == reporter_id:
            return jsonify({"message": "본인이 만든 모임은 신고할 수 없습니다."}), 400
    elif target_type == "chat_room":
        room = ChatRoom.query.get(target_id)
        if not room:
            return jsonify({"message": "신고할 채팅방을 찾지 못했습니다."}), 404
        if room.meeting and room.meeting.host_id == reporter_id:
            return jsonify({"message": "본인이 만든 모임의 채팅방은 신고할 수 없습니다."}), 400
        try:
            ensure_chat_access(target_id, reporter_id)
        except PermissionError as error:
            return jsonify({"message": str(error)}), 403

    existing_report = Report.query.filter_by(
        reporter_id=reporter_id,
        target_type=target_type,
        target_id=target_id
    ).first()
    if existing_report:
        return jsonify({"message": duplicate_report_message(target_type)}), 409

    report = Report(
        reporter_id=reporter_id,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        reason_detail=reason_detail,
        context=data.get("context") if isinstance(data.get("context"), str) else json.dumps(data.get("context") or {}, ensure_ascii=False)
    )
    db.session.add(report)
    admins = User.query.filter(User.role.in_(["superadmin", "admin"])).all()
    for admin in admins:
        create_notification(
            admin.id,
            "report",
            "새 신고가 접수되었습니다",
            f"{report.target_label()}에 대한 신고가 접수되었습니다.",
            "/admin/reports",
            commit=False,
            send_push=False,
        )
    db.session.commit()
    return jsonify({"report": report.to_dict()}), 201
