import os
import json
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import ChatMessage, ChatRoom, DirectChatMessage, DirectChatRoom, Meeting, Report, User, Participant, Sport
from app.services.meeting_service import recalculate_current_participants
from app.utils.timezone import kst_now, parse_client_datetime
from app.utils.audit import log_admin_action

admin_bp = Blueprint("admin", __name__)


def admin_limit(default=200, maximum=500):
    try:
        return max(1, min(int(request.args.get("limit", default)), maximum))
    except (TypeError, ValueError):
        return default


ADMIN_MEETING_OPTIONS = (
    joinedload(Meeting.host).joinedload(User.profile),
    joinedload(Meeting.sport).joinedload(Sport.category),
    joinedload(Meeting.chat_room),
)


@admin_bp.get("/users")
def users():
    items = (
        User.query
        .options(joinedload(User.profile))
        .order_by(User.created_at.desc())
        .limit(admin_limit())
        .all()
    )
    return jsonify({"items": [user.to_dict() for user in items]})


@admin_bp.get("/users/<int:user_id>")
def user_detail(user_id):
    user = User.query.options(joinedload(User.profile)).get_or_404(user_id)
    
    now = kst_now()
    
    # Calculate meetings counts (only count completed ones)
    meetings_count = Meeting.query.filter(Meeting.host_id == user.id, Meeting.end_at < now).count()
    participant_count = Participant.query.join(Meeting).filter(
        Participant.user_id == user.id,
        Participant.status == "approved",
        Participant.role != "host",
        Meeting.end_at < now
    ).count()
    total_meetings = meetings_count + participant_count
    
    # Recent activities (completed meetings)
    joined_meetings = []
    participants = Participant.query.join(Meeting).filter(
        Participant.user_id == user.id,
        Participant.status == "approved",
        Meeting.end_at < now
    ).options(
        joinedload(Participant.meeting).joinedload(Meeting.sport).joinedload(Sport.category)
    ).order_by(Meeting.end_at.desc()).limit(5).all()
    
    for p in participants:
        meeting = p.meeting
        if meeting:
            joined_meetings.append({
                "id": meeting.id,
                "title": meeting.title,
                "category": meeting.sport.name if meeting.sport else "기타",
                "time": meeting.start_at.strftime("%Y.%m.%d %H:%M") if meeting.start_at else "",
                "status": "참여완료"
            })
            
    # Reports
    reports_list = [
        {
            "id": r.id,
            "date": r.created_at.strftime("%Y.%m.%d") if r.created_at else "",
            "reason": r.reason
        }
        for r in Report.query.filter_by(target_type="user", target_id=user.id).order_by(Report.created_at.desc()).limit(50).all()
    ]
    
    res_data = user.to_dict()
    res_data["stats"] = {
        "meetingsCount": total_meetings,
        "attendanceRate": int(user.profile.attendance_rate) if user.profile else 0,
        "mannerScore": round(user.profile.rating_average, 1) if user.profile else 0.0,
        "reviewsCount": 0
    }
    res_data["activities"] = joined_meetings
    res_data["reports"] = reports_list
    return jsonify({"user": res_data})


@admin_bp.get("/meetings")
def meetings():
    items = (
        Meeting.query
        .options(*ADMIN_MEETING_OPTIONS)
        .order_by(Meeting.created_at.desc())
        .limit(admin_limit())
        .all()
    )
    return jsonify({"items": [meeting.to_dict() for meeting in items]})


@admin_bp.get("/meetings/<int:meeting_id>")
def meeting_detail(meeting_id):
    meeting = Meeting.query.options(*ADMIN_MEETING_OPTIONS).get_or_404(meeting_id)
    from app.models import Participant, Report
    participants = (
        Participant.query
        .options(joinedload(Participant.user).joinedload(User.profile))
        .filter_by(meeting_id=meeting.id, status="approved")
        .all()
    )
    
    reports = [
        {
            "id": r.id,
            "date": r.created_at.strftime("%Y.%m.%d") if r.created_at else "",
            "reason": r.reason
        }
        for r in Report.query.filter_by(target_type="meeting", target_id=meeting.id).order_by(Report.created_at.desc()).limit(50).all()
    ]
    
    members_list = [
        {
            "id": p.user.id,
            "nickname": p.user.nickname or p.user.name or "알 수 없음",
            "role": "방장" if p.role == "host" else "멤버",
            "joinedAt": p.requested_at.strftime("%Y.%m.%d %H:%M") if p.requested_at else "",
            "manner": f"{round(p.user.profile.rating_average, 1) if p.user.profile else 0.0} / 5.0"
        }
        for p in participants
    ]
    members_list.sort(key=lambda m: 0 if m["role"] == "방장" else 1)
    
    res_data = meeting.to_dict()
    res_data["members"] = members_list
    res_data["reports"] = reports
    return jsonify({"meeting": res_data})


@admin_bp.get("/reports")
@jwt_required()
def reports():
    admin_user = _require_admin_user()
    if not admin_user:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403

    status = request.args.get("status")
    query = Report.query.options(joinedload(Report.reporter), joinedload(Report.admin))
    if status and status != "all":
        query = query.filter(Report.status == status)
    return jsonify({
        "items": [
            item.to_dict(include_internal=True)
            for item in query.order_by(Report.created_at.desc(), Report.id.desc()).limit(admin_limit()).all()
        ]
    })


def _report_user_summary(user):
    if not user:
        return None
    received_total = Report.query.filter_by(target_type="user", target_id=user.id).count()
    received_pending = Report.query.filter_by(target_type="user", target_id=user.id, status="pending").count()
    made_total = Report.query.filter_by(reporter_id=user.id).count()
    made_dismissed = Report.query.filter_by(reporter_id=user.id, status="dismissed").count()
    hosted_count = Meeting.query.filter_by(host_id=user.id).count()
    joined_count = Participant.query.filter_by(user_id=user.id, status="approved").count()
    data = user.to_dict()
    data["report_stats"] = {
        "received_total": received_total,
        "received_pending": received_pending,
        "made_total": made_total,
        "made_dismissed": made_dismissed,
        "hosted_meetings": hosted_count,
        "joined_meetings": joined_count,
    }
    return data


def _message_log_item(message):
    data = message.to_dict()
    data["room_type"] = "meeting"
    if message.room and message.room.meeting:
        data["meeting"] = {
            "id": message.room.meeting.id,
            "title": message.room.meeting.title,
            "location_name": message.room.meeting.location_name,
        }
    return data


def _direct_message_log_item(message):
    data = message.to_dict()
    data["room_type"] = "direct"
    if message.room:
        data["direct_room"] = {
            "id": message.room.id,
            "user_a": message.room.user_a.to_dict() if message.room.user_a else None,
            "user_b": message.room.user_b.to_dict() if message.room.user_b else None,
        }
    return data


@admin_bp.get("/reports/<int:report_id>")
@jwt_required()
def report_detail(report_id):
    admin_user = _require_admin_user()
    if not admin_user:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403

    report = Report.query.options(joinedload(Report.reporter), joinedload(Report.admin)).get_or_404(report_id)
    target_user = User.query.get(report.target_id) if report.target_type == "user" else None
    target_meeting = Meeting.query.options(*ADMIN_MEETING_OPTIONS).get(report.target_id) if report.target_type == "meeting" else None
    target_room = ChatRoom.query.options(
        joinedload(ChatRoom.meeting),
        joinedload(ChatRoom.messages).joinedload(ChatMessage.sender).joinedload(User.profile),
    ).get(report.target_id) if report.target_type == "chat_room" else None

    room_logs = []
    user_logs = []
    direct_logs = []
    if target_room:
        ordered = sorted(target_room.messages, key=lambda message: (message.created_at, message.id))
        room_logs = [_message_log_item(message) for message in ordered[-250:]]
    if target_user:
        user_messages = (
            ChatMessage.query
            .options(
                joinedload(ChatMessage.sender).joinedload(User.profile),
                joinedload(ChatMessage.room).joinedload(ChatRoom.meeting),
            )
            .filter(ChatMessage.user_id == target_user.id)
            .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
            .limit(200)
            .all()
        )
        user_logs = [_message_log_item(message) for message in reversed(user_messages)]
        direct_messages = (
            DirectChatMessage.query
            .options(
                joinedload(DirectChatMessage.sender).joinedload(User.profile),
                joinedload(DirectChatMessage.room).joinedload(DirectChatRoom.user_a).joinedload(User.profile),
                joinedload(DirectChatMessage.room).joinedload(DirectChatRoom.user_b).joinedload(User.profile),
            )
            .filter(DirectChatMessage.sender_id == target_user.id)
            .order_by(DirectChatMessage.created_at.desc(), DirectChatMessage.id.desc())
            .limit(100)
            .all()
        )
        direct_logs = [_direct_message_log_item(message) for message in reversed(direct_messages)]

    related_reports = []
    if target_user:
        related_reports = [
            item.to_dict(include_internal=True)
            for item in Report.query
            .options(joinedload(Report.reporter), joinedload(Report.admin))
            .filter(Report.target_type == "user", Report.target_id == target_user.id, Report.id != report.id)
            .order_by(Report.created_at.desc(), Report.id.desc())
            .limit(20)
            .all()
        ]

    return jsonify({
        "report": report.to_dict(include_internal=True),
        "reporter": _report_user_summary(report.reporter),
        "target_user": _report_user_summary(target_user),
        "target_meeting": target_meeting.to_dict() if target_meeting else None,
        "target_room": target_room.to_dict() if target_room else None,
        "chat_logs": room_logs,
        "user_chat_logs": user_logs,
        "direct_chat_logs": direct_logs,
        "related_reports": related_reports,
    })


@admin_bp.patch("/reports/<int:report_id>")
@jwt_required()
def update_report(report_id):
    admin_user = _require_admin_user()
    if not admin_user:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403

    report = Report.query.options(joinedload(Report.reporter), joinedload(Report.admin)).get_or_404(report_id)
    data = request.get_json() or {}
    status = data.get("status") or report.status
    if status not in {"pending", "in_progress", "resolved", "dismissed"}:
        return jsonify({"message": "지원하지 않는 신고 상태입니다."}), 400

    previous_status = report.status
    report.status = status
    report.admin_id = admin_user.id
    if "admin_note" in data:
        report.admin_note = (data.get("admin_note") or "").strip()
    if status in {"resolved", "dismissed"} and not report.resolved_at:
        report.resolved_at = kst_now()
    if status in {"pending", "in_progress"}:
        report.resolved_at = None

    if previous_status != status and status in {"resolved", "dismissed"}:
        from app.services.notification_service import create_notification
        if status == "resolved":
            title = "신고 검토가 완료되었습니다"
            message = "접수하신 신고를 검토했으며, 운영 정책에 따라 필요한 조치를 진행했습니다."
        else:
            title = "신고 검토 결과 안내"
            message = "접수하신 신고를 검토했으나, 현재 제공된 내용만으로는 추가 조치가 어렵습니다."
        create_notification(
            report.reporter_id,
            "report_result",
            title,
            message,
            "/notifications",
            send_push=True
        )

    db.session.commit()

    from app.utils.audit import log_admin_action
    log_admin_action(
        admin_name=admin_user.nickname or admin_user.name or admin_user.email,
        action_type="신고 처리",
        description=f"신고 #{report.id} ({report.target_label()}) 상태를 {status}(으)로 저장했습니다.",
        target_id=report.id
    )

    return jsonify({"item": report.to_dict(include_internal=True), "message": "신고 처리 내용이 저장되었습니다."})


@admin_bp.patch("/meetings/<int:meeting_id>")
@jwt_required()
def update_meeting(meeting_id):
    from flask_jwt_extended import get_jwt_identity
    current_user_id = int(get_jwt_identity())
    admin_user = User.query.options(joinedload(User.profile)).get(current_user_id)
    if not admin_user or admin_user.role not in ["superadmin", "admin"]:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403

    meeting = Meeting.query.get_or_404(meeting_id)
    from flask import request
    from app.extensions import db
    
    data = request.get_json() or {}
    
    updatable_fields = [
        "sport_id",
        "title",
        "description",
        "meeting_type",
        "purpose",
        "region_sido_code",
        "region_sigungu_code",
        "location_name",
        "address",
        "latitude",
        "longitude",
        "max_participants",
        "cover_image_url",
        "status"
    ]
    for field in updatable_fields:
        if field in data:
            setattr(meeting, field, data[field])
            
    if "start_at" in data and data["start_at"]:
        try:
            meeting.start_at = parse_client_datetime(data["start_at"])
        except ValueError:
            pass
            
    if "end_at" in data and data["end_at"]:
        try:
            meeting.end_at = parse_client_datetime(data["end_at"])
        except ValueError:
            pass
            
    meeting.sync_status()
    db.session.commit()

    from app.utils.audit import log_admin_action
    log_admin_action(
        admin_name=admin_user.nickname or admin_user.name or admin_user.email,
        action_type="모임 수정",
        description=f"모임 ID {meeting_id} ({meeting.title})의 정보를 수정했습니다.",
        target_id=meeting_id
    )

    return jsonify({"meeting": meeting.to_dict()})


@admin_bp.delete("/meetings/<int:meeting_id>")
@jwt_required()
def delete_meeting(meeting_id):
    from flask_jwt_extended import get_jwt_identity
    current_user_id = int(get_jwt_identity())
    admin_user = User.query.options(joinedload(User.profile)).get(current_user_id)
    if not admin_user or admin_user.role not in ["superadmin", "admin"]:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403

    meeting = Meeting.query.get_or_404(meeting_id)
    from app.extensions import db
    meeting.status = "suspended"
    meeting.suspended_at = kst_now()
    
    db.session.commit()

    from app.utils.audit import log_admin_action
    log_admin_action(
        admin_name=admin_user.nickname or admin_user.name or admin_user.email,
        action_type="모임 폐쇄",
        description=f"모임 ID {meeting_id} ({meeting.title})을(를) 강제 폐쇄(정지)했습니다.",
        target_id=meeting_id
    )

    return jsonify({"success": True})


@admin_bp.post("/meetings/<int:meeting_id>/restore")
@jwt_required()
def restore_meeting(meeting_id):
    from flask_jwt_extended import get_jwt_identity
    current_user_id = int(get_jwt_identity())
    admin_user = User.query.options(joinedload(User.profile)).get(current_user_id)
    if not admin_user or admin_user.role not in ["superadmin", "admin"]:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403

    meeting = Meeting.query.get_or_404(meeting_id)
    from app.extensions import db
    
    if meeting.status != "suspended":
        return jsonify({"message": "폐쇄 유예 상태가 아닌 모임은 복구할 수 없습니다."}), 400
        
    meeting.status = "open"
    meeting.suspended_at = None
    meeting.sync_status()
    
    db.session.commit()

    from app.utils.audit import log_admin_action
    log_admin_action(
        admin_name=admin_user.nickname or admin_user.name or admin_user.email,
        action_type="모임 복구",
        description=f"폐쇄된 모임 ID {meeting_id} ({meeting.title})을(를) 정상 복구했습니다.",
        target_id=meeting_id
    )

    return jsonify({"success": True, "meeting": meeting.to_dict()})


@admin_bp.delete("/meetings/<int:meeting_id>/members/<int:user_id>")
@jwt_required()
def kick_member(meeting_id, user_id):
    from flask_jwt_extended import get_jwt_identity
    current_user_id = int(get_jwt_identity())
    admin_user = User.query.options(joinedload(User.profile)).get(current_user_id)
    if not admin_user or admin_user.role not in ["superadmin", "admin"]:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403

    from app.extensions import db
    participant = Participant.query.filter_by(meeting_id=meeting_id, user_id=user_id).first_or_404()
    if participant.role == "host":
        return jsonify({"message": "방장은 강제 퇴장시킬 수 없습니다."}), 400
        
    target_user = User.query.get(user_id)
    target_user_name = target_user.name or target_user.email if target_user else f"ID {user_id}"
        
    meeting = Meeting.query.get(meeting_id)
    db.session.delete(participant)
    db.session.flush()
    if meeting:
        recalculate_current_participants(meeting)
    db.session.commit()

    from app.utils.audit import log_admin_action
    meeting_title = meeting.title if meeting else f"ID {meeting_id}"
    log_admin_action(
        admin_name=admin_user.nickname or admin_user.name or admin_user.email,
        action_type="멤버 강퇴",
        description=f"모임 '{meeting_title}'에서 회원 {target_user_name}(ID {user_id})을(를) 강제 퇴장시켰습니다.",
        target_id=meeting_id
    )

    return jsonify({"success": True})


@admin_bp.patch("/users/<int:user_id>")
@jwt_required()
def update_user(user_id):
    from flask_jwt_extended import get_jwt_identity
    current_user_id = int(get_jwt_identity())
    admin_user = User.query.options(joinedload(User.profile)).get(current_user_id)
    if not admin_user or admin_user.role not in ["superadmin", "admin"]:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403
        
    user = User.query.options(joinedload(User.profile)).get_or_404(user_id)
    was_suspended = (user.role == "suspended" or not user.is_active)
    from flask import request
    from app.extensions import db
    from app.models import UserProfile
    
    data = request.get_json() or {}

    # 1. Restriction: Standard admin cannot manage superadmin or other admin users.
    if admin_user.role == "admin" and user.role in ["superadmin", "admin"]:
        return jsonify({"message": "일반 관리자는 최고관리자 또는 관리자 등급을 관리할 수 없습니다."}), 403

    # 2. Restriction: Check if suspension is requested and validate
    if "is_active" in data and not data["is_active"]:
        if int(admin_user.id) == int(user.id) and admin_user.role == "superadmin":
            return jsonify({"message": "최고관리자는 자기 자신을 정지할 수 없습니다."}), 400
        if user.role == "superadmin":
            superadmin_count = User.query.filter(User.role == "superadmin").count()
            if superadmin_count <= 1:
                return jsonify({"message": "시스템 내 최고관리자는 최소 1명 존재해야 합니다. 최고관리자를 정지할 수 없습니다."}), 400
    
    # Check if role update is requested
    if "role" in data:
        new_role = data["role"]
        
        # 1. Prevent superadmin from changing their own role to another role (self-demotion restriction)
        print(f"[ROLE UPDATE] Admin user ID: {admin_user.id} (type: {type(admin_user.id)}), Target user ID: {user.id} (type: {type(user.id)})")
        if int(admin_user.id) == int(user.id) and admin_user.role == "superadmin" and new_role != "superadmin":
            return jsonify({"message": "최고관리자는 자기 자신의 등급을 다른 등급으로 변경할 수 없습니다. 최고관리자 권한을 먼저 이양하십시오."}), 400

        # 2. Prevent demoting the last superadmin in the database
        if user.role == "superadmin" and new_role != "superadmin":
            superadmin_count = User.query.filter(User.role == "superadmin").count()
            if superadmin_count <= 1:
                return jsonify({"message": "시스템 내 최고관리자는 최소 1명 존재해야 합니다. 마지막 최고관리자는 다른 등급으로 강등할 수 없습니다."}), 400
            
        # 3. Prevent transferring superadmin role to a user who is not currently an admin
        if new_role == "superadmin" and user.role != "admin" and user.role != "superadmin":
            return jsonify({"message": "최고관리자 권한은 일반 관리자(admin) 등급에게만 이양할 수 있습니다."}), 400

        # Restriction: If standard admin, they can only change user's role to/from user, suspended, and pending_withdrawal.
        # They cannot set or remove superadmin/admin roles.
        if admin_user.role == "admin":
            if user.role in ["superadmin", "admin"] or new_role in ["superadmin", "admin"]:
                return jsonify({"message": "일반 관리자는 최고관리자 또는 관리자 등급을 관리할 수 없습니다."}), 403
            
            allowed_roles = ["user", "suspended", "pending_withdrawal"]
            if new_role not in allowed_roles:
                return jsonify({"message": f"허용되지 않은 등급입니다: {new_role}"}), 400
                
        # If setting new superadmin, demote other superadmins to admin to ensure single superadmin
        if new_role == "superadmin":
            other_superadmins = User.query.filter(User.role == "superadmin", User.id != user.id).all()
            for other in other_superadmins:
                other.role = "admin"
                
        user.role = new_role
        if new_role == "suspended":
            user.is_active = False
        elif new_role == "pending_withdrawal":
            # user.is_active = False # 탈퇴 대기 상태도 로그인 가능하도록
            from app.utils.time_utils import kst_now
            user.deleted_at = user.deleted_at or kst_now()
        else:
            if user.is_active == False:
                user.is_active = True
            user.deleted_at = None
    
    # Update User fields
    user_fields = ["name", "email", "phone_number", "nickname"]
    for field in user_fields:
        if field in data:
            setattr(user, field, data[field])
            
    if "is_active" in data:
        is_active = data["is_active"]
        user.is_active = is_active
        if not is_active:
            user.role = "suspended"
        elif user.role in ["suspended", "pending_withdrawal"]:
            user.role = "user"
            user.deleted_at = None
            
    # Update UserProfile fields
    if "region" in data or "preferred_sports" in data:
        profile = user.profile
        if not profile:
            profile = UserProfile(user_id=user.id)
            db.session.add(profile)
        if "region" in data:
            profile.region = data["region"]
        if "preferred_sports" in data:
            profile.preferred_sports = data["preferred_sports"]
            
    is_suspended = (user.role == "suspended" or not user.is_active)
    if is_suspended and not was_suspended:
        from app.services.notification_service import create_notification
        create_notification(
            user_id=user.id,
            type="account_suspension",
            title="계정 정지 안내",
            message="귀하의 계정이 정지되었습니다. 관련 문의사항은 고객센터로 연락해주시기 바랍니다.",
            link_url="/support",
            commit=False,
            send_push=True
        )
    elif was_suspended and not is_suspended:
        from app.services.notification_service import create_notification
        create_notification(
            user_id=user.id,
            type="account_unsuspension",
            title="계정 정지 해제 안내",
            message="귀하의 계정 정지가 해제되었습니다. 이제 서비스를 정상적으로 이용하실 수 있습니다.",
            link_url="/support",
            commit=False,
            send_push=True
        )
            
    db.session.commit()

    from app.utils.audit import log_admin_action
    target_username = user.name or user.email
    changes = []
    if "role" in data:
        changes.append(f"권한을 {data['role']}(으)로 변경")
    if "is_active" in data:
        changes.append("계정 활성화 상태 변경" if data['is_active'] else "계정 정지 처리")
    if "email" in data or "name" in data or "nickname" in data:
        changes.append("회원 개인 정보 수정")
    
    change_desc = ", ".join(changes) if changes else "회원 정보 수정"
    log_admin_action(
        admin_name=admin_user.nickname or admin_user.name or admin_user.email,
        action_type="회원 관리",
        description=f"회원 {target_username}(ID {user_id})의 {change_desc} 작업을 수행했습니다.",
        target_id=user_id
    )

    return jsonify({"user": user.to_dict()})


@admin_bp.get("/settings")
@jwt_required()
def get_settings():
    from app.utils.settings import load_system_settings, load_settings_logs
    settings = load_system_settings()
    logs = load_settings_logs()
    last_sync = logs[-1] if logs else None
    return jsonify({
        "settings": settings,
        "last_sync": last_sync
    })


@admin_bp.post("/settings")
@jwt_required()
def update_settings():
    from app.utils.settings import load_system_settings, save_system_settings, add_settings_log
    from flask_jwt_extended import get_jwt_identity
    from app.models import User
    
    current_admin_id = get_jwt_identity()
    admin_user = User.query.get(int(current_admin_id))
    admin_name = admin_user.nickname or admin_user.name or admin_user.email if admin_user else "알 수 없는 관리자"

    data = request.get_json() or {}
    current_settings = load_system_settings()
    
    changes = []
    labels = {
        "siteName": "서비스명",
        "adminEmail": "대표 이메일",
        "maintenanceMode": "점검 모드",
        "suspensionGracePeriod": "폐쇄 유예 기간",
        "defaultMaxParticipants": "기본 개설 최대 정원",
        "mannerRatingDecrement": "신고 감점량",
        "autoBanReportCount": "자동 정지 기준",
        "sessionExpiryMinutes": "세션 만료 시간",
        "termsVersion": "약관 버전",
        "supabaseUrl": "Supabase 주소",
        "kakaoApiKey": "Kakao API 키",
        "googleClientId": "Google 클라이언트 ID"
    }
    
    for k, v in data.items():
        if k in current_settings and current_settings[k] != v:
            label = labels.get(k, k)
            old_val = "활성" if current_settings[k] is True else ("비활성" if current_settings[k] is False else current_settings[k])
            new_val = "활성" if v is True else ("비활성" if v is False else v)
            changes.append(f"{label} 변경: {old_val} ➔ {new_val}")
            current_settings[k] = v

    if not changes:
        return jsonify({"success": True, "settings": current_settings})

    if save_system_settings(current_settings):
        add_settings_log(admin_name, changes)
        
        from app.utils.audit import log_admin_action
        log_admin_action(
            admin_name=admin_name,
            action_type="설정 변경",
            description=f"시스템 환경 설정을 변경했습니다. ({', '.join(changes)})"
        )
        return jsonify({"success": True, "settings": current_settings})
    return jsonify({"message": "설정 저장 실패"}), 500


@admin_bp.get("/settings/logs")
@jwt_required()
def get_settings_logs():
    from app.utils.settings import load_settings_logs
    return jsonify(load_settings_logs())


@admin_bp.post("/users/<int:user_id>/message")
@jwt_required()
def send_user_message(user_id):
    from flask_jwt_extended import get_jwt_identity
    current_user_id = int(get_jwt_identity())
    admin_user = User.query.options(joinedload(User.profile)).get(current_user_id)
    if not admin_user or admin_user.role not in ["superadmin", "admin"]:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403

    user = User.query.options(joinedload(User.profile)).get_or_404(user_id)
    data = request.get_json() or {}
    message_text = data.get("message")
    if not message_text:
        return jsonify({"message": "메시지 내용을 입력해주세요."}), 400

    from app.services.notification_service import create_notification
    create_notification(
        user_id=user.id,
        type="admin_message",
        title="관리자 알림",
        message=message_text,
        link_url="/support",
        commit=True,
        send_push=True
    )
    db.session.commit()

    from app.utils.audit import log_admin_action
    target_username = user.name or user.email
    log_admin_action(
        admin_name=admin_user.nickname or admin_user.name or admin_user.email,
        action_type="개별 알림 발송",
        description=f"회원 {target_username}(ID {user_id})에게 개별 알림을 전송했습니다. 내용: '{message_text[:30]}...'",
        target_id=user_id
    )

    return jsonify({"success": True, "message": "메시지가 성공적으로 전송되었습니다."})


SYSTEM_BROADCAST_LOGS_FILE = "/teamproject3/sportsmate/backend/system_broadcast_logs.json"

def load_broadcast_logs():
    import json
    import os
    # Convert path to absolute or relative depending on system
    file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "system_broadcast_logs.json")
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []

def add_broadcast_log(admin_name, title, message, link_url, target_type, target_value, target_count, send_push):
    import json
    import os
    file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "system_broadcast_logs.json")
    logs = load_broadcast_logs()
    new_entry = {
        "timestamp": kst_now().strftime("%Y-%m-%d %H:%M:%S"),
        "admin": admin_name,
        "title": title,
        "message": message,
        "link_url": link_url,
        "target_type": target_type,
        "target_value": target_value,
        "target_count": target_count,
        "send_push": send_push
    }
    logs.append(new_entry)
    if len(logs) > 100:
        logs = logs[-100:]
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(logs, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False


@admin_bp.get("/broadcast/logs")
@jwt_required()
def get_broadcast_logs():
    from flask_jwt_extended import get_jwt_identity
    current_user_id = int(get_jwt_identity())
    admin_user = User.query.options(joinedload(User.profile)).get(current_user_id)
    if not admin_user or admin_user.role not in ["superadmin", "admin"]:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403

    return jsonify(load_broadcast_logs())


@admin_bp.post("/broadcast")
@jwt_required()
def send_broadcast():
    from flask_jwt_extended import get_jwt_identity
    current_user_id = int(get_jwt_identity())
    admin_user = User.query.options(joinedload(User.profile)).get(current_user_id)
    if not admin_user or admin_user.role not in ["superadmin", "admin"]:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403

    data = request.get_json() or {}
    title = data.get("title")
    message = data.get("message")
    link_url = data.get("link_url") or "/support"
    target_type = data.get("target_type") or "all"
    target_value = data.get("target_value")
    send_push = data.get("send_push", True)

    if not title or not message:
        return jsonify({"message": "제목과 내용을 모두 입력해 주세요."}), 400

    # Query target users
    query = User.query
    if target_type == "region" and target_value:
        from app.models import UserProfile
        query = query.join(User.profile).filter(UserProfile.region.like(f"%{target_value}%"))
    elif target_type == "role" and target_value:
        query = query.filter(User.role == target_value)

    target_users = query.all()
    if not target_users:
        return jsonify({"message": "대상 회원이 존재하지 않습니다."}), 400

    from app.services.notification_service import create_notification
    sent_count = 0
    for target in target_users:
        create_notification(
            user_id=target.id,
            type="admin_broadcast",
            title=title,
            message=message,
            link_url=link_url,
            commit=False,
            send_push=send_push
        )
        sent_count += 1

    from app.extensions import db
    db.session.commit()

    admin_name = admin_user.nickname or admin_user.name or admin_user.email
    add_broadcast_log(
        admin_name=admin_name,
        title=title,
        message=message,
        link_url=link_url,
        target_type=target_type,
        target_value=target_value,
        target_count=sent_count,
        send_push=send_push
    )

    from app.utils.audit import log_admin_action
    target_desc = "전체 회원" if target_type == "all" else (f"지역: {target_value}" if target_type == "region" else f"등급: {target_value}")
    log_admin_action(
        admin_name=admin_name,
        action_type="단체 알림 발송",
        description=f"대상 [{target_desc}]에게 단체 공지 알림을 발송했습니다. 수신 대상: {sent_count}명, 제목: '{title}'"
    )

    return jsonify({
        "success": True,
        "message": f"{sent_count}명의 회원에게 알림 전송이 완료되었습니다.",
        "target_count": sent_count
    })


@admin_bp.get("/audit-logs")
@jwt_required()
def get_audit_logs():
    from flask_jwt_extended import get_jwt_identity
    current_user_id = int(get_jwt_identity())
    admin_user = User.query.options(joinedload(User.profile)).get(current_user_id)
    if not admin_user or admin_user.role not in ["superadmin", "admin"]:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403

    from app.utils.audit import load_audit_logs
    return jsonify(load_audit_logs())




SUPPORT_STATUS_LABELS = {
    "pending": "접수",
    "in_progress": "처리 중",
    "resolved": "답변 완료",
    "closed": "종료",
}

SUPPORT_PRIORITY_VALUES = {"low", "normal", "high", "urgent"}


def _require_admin_user():
    from flask_jwt_extended import get_jwt_identity
    current_user_id = int(get_jwt_identity())
    admin_user = User.query.options(joinedload(User.profile)).get(current_user_id)
    if not admin_user or admin_user.role not in ["superadmin", "admin"]:
        return None
    return admin_user


@admin_bp.get("/support/inquiries")
@jwt_required()
def list_support_inquiries():
    from app.models import SupportInquiry

    admin_user = _require_admin_user()
    if not admin_user:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403

    status = request.args.get("status")
    category = request.args.get("category")
    query = SupportInquiry.query.options(joinedload(SupportInquiry.user), joinedload(SupportInquiry.admin))
    if status and status != "all":
        if status == "pending":
            query = query.filter(SupportInquiry.status.in_(["pending", "in_progress"]))
        elif status == "resolved":
            query = query.filter(SupportInquiry.status.in_(["resolved", "closed"]))
        else:
            query = query.filter(SupportInquiry.status == status)
    if category and category != "all":
        query = query.filter(SupportInquiry.category == category)

    items = query.order_by(SupportInquiry.created_at.desc(), SupportInquiry.id.desc()).limit(admin_limit()).all()
    return jsonify({"items": [item.to_dict(include_internal=True) for item in items]})


@admin_bp.patch("/support/inquiries/<int:inquiry_id>")
@jwt_required()
def update_support_inquiry(inquiry_id):
    from app.models import SupportInquiry
    from app.services.notification_service import create_notification
    from app.utils.audit import log_admin_action
    from app.utils.timezone import to_kst_iso, kst_now

    admin_user = _require_admin_user()
    if not admin_user:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403

    inquiry = SupportInquiry.query.options(joinedload(SupportInquiry.user)).get_or_404(inquiry_id)
    data = request.get_json() or {}
    previous_status = inquiry.status
    previous_response = inquiry.admin_response or ""

    if "status" in data:
        next_status = data.get("status")
        if next_status not in SUPPORT_STATUS_LABELS:
            return jsonify({"message": "지원하지 않는 문의 상태입니다."}), 400
        inquiry.status = next_status
        if next_status in {"resolved", "closed"} and not inquiry.resolved_at:
            inquiry.resolved_at = kst_now()
        if next_status in {"pending", "in_progress"}:
            inquiry.resolved_at = None

    if "priority" in data:
        priority = data.get("priority") or "normal"
        if priority not in SUPPORT_PRIORITY_VALUES:
            return jsonify({"message": "지원하지 않는 우선순위입니다."}), 400
        inquiry.priority = priority

    if "admin_response" in data:
        inquiry.admin_response = (data.get("admin_response") or "").strip()
    if "internal_note" in data:
        inquiry.internal_note = (data.get("internal_note") or "").strip()

    inquiry.admin_id = admin_user.id

    import json
    try:
        history_list = json.loads(inquiry.reply_history or "[]")
    except Exception:
        history_list = []

    new_entry = {
        "admin_name": admin_user.nickname or admin_user.name or admin_user.email,
        "admin_email": admin_user.email,
        "admin_response": inquiry.admin_response or "",
        "internal_note": inquiry.internal_note or "",
        "status": inquiry.status,
        "updated_at": to_kst_iso(kst_now())
    }
    history_list.insert(0, new_entry)
    inquiry.reply_history = json.dumps(history_list, ensure_ascii=False)

    should_notify = previous_status != inquiry.status or previous_response != (inquiry.admin_response or "")
    if should_notify and inquiry.user_id:
        status_label = SUPPORT_STATUS_LABELS.get(inquiry.status, inquiry.status)
        title = "문의 답변이 등록되었습니다" if inquiry.admin_response else "문의 처리 상태가 변경되었습니다"
        create_notification(
            inquiry.user_id,
            "support_reply",
            title,
            f"'{inquiry.title}' 문의가 {status_label} 상태로 업데이트되었습니다.",
            "/support",
            commit=False,
            send_push=True,
        )

    db.session.commit()

    admin_name = admin_user.nickname or admin_user.name or admin_user.email
    log_admin_action(
        admin_name=admin_name,
        action_type="고객 문의 처리",
        description=f"문의 #{inquiry.id} '{inquiry.title}' 상태를 {SUPPORT_STATUS_LABELS.get(inquiry.status, inquiry.status)}(으)로 저장했습니다."
    )

    return jsonify({"item": inquiry.to_dict(include_internal=True), "message": "문의 처리 내용이 저장되었습니다."})


# --- System Notice Management ---
SYSTEM_NOTICES_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "system_notices.json")

def load_system_notices():
    import json
    if os.path.exists(SYSTEM_NOTICES_FILE_PATH):
        try:
            with open(SYSTEM_NOTICES_FILE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []

def save_system_notices(notices):
    import json
    try:
        with open(SYSTEM_NOTICES_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(notices, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False

@admin_bp.get("/notices")
@jwt_required()
def get_admin_notices():
    current_user_id = int(get_jwt_identity())
    admin_user = User.query.get(current_user_id)
    if not admin_user or admin_user.role not in ["superadmin", "admin"]:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403
    notices = load_system_notices()
    # Sort: is_pinned (True first) then created_at (newest first)
    notices.sort(key=lambda x: (1 if x.get("is_pinned") else 0, x.get("created_at", "")), reverse=True)
    return jsonify(notices)

@admin_bp.post("/notices")
@jwt_required()
def create_admin_notice():
    current_user_id = int(get_jwt_identity())
    admin_user = User.query.get(current_user_id)
    if not admin_user or admin_user.role not in ["superadmin", "admin"]:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403

    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    content = (data.get("content") or "").strip()
    is_pinned = bool(data.get("is_pinned", False))

    if not title or not content:
        return jsonify({"message": "제목과 내용을 모두 입력해주세요."}), 400

    import time
    from app.utils.timezone import kst_now
    
    notices = load_system_notices()
    new_notice = {
        "id": int(time.time() * 1000),
        "title": title,
        "content": content,
        "is_pinned": is_pinned,
        "author": admin_user.nickname or admin_user.name or admin_user.email,
        "created_at": kst_now().isoformat()
    }
    notices.append(new_notice)
    save_system_notices(notices)

    log_admin_action(
        admin_name=new_notice["author"],
        action_type="공지사항 등록",
        description=f"공지사항 '{title}'을 등록했습니다."
    )
    return jsonify({"item": new_notice, "message": "공지사항이 성공적으로 등록되었습니다."}), 201

@admin_bp.put("/notices/<int:notice_id>")
@jwt_required()
def update_admin_notice(notice_id):
    current_user_id = int(get_jwt_identity())
    admin_user = User.query.get(current_user_id)
    if not admin_user or admin_user.role not in ["superadmin", "admin"]:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403

    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    content = (data.get("content") or "").strip()
    is_pinned = bool(data.get("is_pinned", False))

    if not title or not content:
        return jsonify({"message": "제목과 내용을 모두 입력해주세요."}), 400

    notices = load_system_notices()
    found_notice = None
    for n in notices:
        if n.get("id") == notice_id:
            found_notice = n
            break

    if not found_notice:
        return jsonify({"message": "존재하지 않는 공지사항입니다."}), 404

    found_notice["title"] = title
    found_notice["content"] = content
    found_notice["is_pinned"] = is_pinned
    save_system_notices(notices)

    admin_name = admin_user.nickname or admin_user.name or admin_user.email
    log_admin_action(
        admin_name=admin_name,
        action_type="공지사항 수정",
        description=f"공지사항 '{title}'을 수정했습니다."
    )
    return jsonify({"item": found_notice, "message": "공지사항이 수정되었습니다."})

@admin_bp.delete("/notices/<int:notice_id>")
@jwt_required()
def delete_admin_notice(notice_id):
    current_user_id = int(get_jwt_identity())
    admin_user = User.query.get(current_user_id)
    if not admin_user or admin_user.role not in ["superadmin", "admin"]:
        return jsonify({"message": "관리자 권한이 필요합니다."}), 403

    notices = load_system_notices()
    notice_to_delete = None
    for n in notices:
        if n.get("id") == notice_id:
            notice_to_delete = n
            break

    if not notice_to_delete:
        return jsonify({"message": "존재하지 않는 공지사항입니다."}), 404

    notices = [n for n in notices if n.get("id") != notice_id]
    save_system_notices(notices)

    admin_name = admin_user.nickname or admin_user.name or admin_user.email
    log_admin_action(
        admin_name=admin_name,
        action_type="공지사항 삭제",
        description=f"공지사항 '{notice_to_delete.get('title')}'을 삭제했습니다."
    )
    return jsonify({"message": "공지사항이 삭제되었습니다."})
