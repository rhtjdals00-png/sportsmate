from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import joinedload

from app.models import Meeting, Report, User, Participant, Sport

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
    
    now = datetime.utcnow()
    
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
def reports():
    return jsonify({
        "items": [
            {
                "id": item.id,
                "target_type": item.target_type,
                "target_id": item.target_id,
                "reason": item.reason,
                "status": item.status,
                "created_at": item.created_at.isoformat() if item.created_at else None
            }
            for item in Report.query.order_by(Report.created_at.desc()).limit(admin_limit()).all()
        ]
    })


@admin_bp.patch("/meetings/<int:meeting_id>")
def update_meeting(meeting_id):
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
            meeting.start_at = datetime.fromisoformat(data["start_at"].replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            pass
            
    if "end_at" in data and data["end_at"]:
        try:
            meeting.end_at = datetime.fromisoformat(data["end_at"].replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            pass
            
    meeting.sync_status()
    db.session.commit()
    return jsonify({"meeting": meeting.to_dict()})


@admin_bp.delete("/meetings/<int:meeting_id>")
def delete_meeting(meeting_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    from app.extensions import db
    from datetime import datetime
    
    meeting.status = "suspended"
    meeting.suspended_at = datetime.utcnow()
    
    db.session.commit()
    return jsonify({"success": True})


@admin_bp.post("/meetings/<int:meeting_id>/restore")
def restore_meeting(meeting_id):
    meeting = Meeting.query.get_or_404(meeting_id)
    from app.extensions import db
    
    if meeting.status != "suspended":
        return jsonify({"message": "폐쇄 유예 상태가 아닌 모임은 복구할 수 없습니다."}), 400
        
    meeting.status = "open"
    meeting.suspended_at = None
    meeting.sync_status()
    
    db.session.commit()
    return jsonify({"success": True, "meeting": meeting.to_dict()})


@admin_bp.delete("/meetings/<int:meeting_id>/members/<int:user_id>")
def kick_member(meeting_id, user_id):
    from app.extensions import db
    participant = Participant.query.filter_by(meeting_id=meeting_id, user_id=user_id).first_or_404()
    if participant.role == "host":
        return jsonify({"message": "방장은 강제 퇴장시킬 수 없습니다."}), 400
        
    meeting = Meeting.query.get(meeting_id)
    if meeting and participant.status == "approved":
        meeting.current_participants = max(1, meeting.current_participants - 1)
        meeting.sync_status()
        
    db.session.delete(participant)
    db.session.commit()
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
        elif user.is_active == False:
            user.is_active = True
    
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
        elif user.role == "suspended":
            user.role = "user"
            
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
            
    db.session.commit()
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
        return jsonify({"success": True, "settings": current_settings})
    return jsonify({"message": "설정 저장 실패"}), 500


@admin_bp.get("/settings/logs")
@jwt_required()
def get_settings_logs():
    from app.utils.settings import load_settings_logs
    return jsonify(load_settings_logs())
