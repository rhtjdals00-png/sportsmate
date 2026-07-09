from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import ChatMessage, ChatMessageRead, ChatRoom, DirectChatRoom, Meeting, Participant, Sport, User
from app.services.chat_service import (
    attach_read_counts,
    ensure_chat_access,
    ensure_direct_room_access,
    get_or_create_direct_room,
    mark_room_messages_read,
    send_direct_message,
    send_message,
)

chat_bp = Blueprint("chat", __name__)


ROOM_LIST_OPTIONS = (
    joinedload(ChatRoom.meeting).joinedload(Meeting.host),
    joinedload(ChatRoom.meeting).joinedload(Meeting.sport).joinedload(Sport.category),
    joinedload(ChatRoom.meeting).joinedload(Meeting.chat_room),
)


def participant_item(participant):
    user_data = participant.user.to_dict() if participant.user else None
    return {
        "id": participant.id,
        "user_id": participant.user_id,
        "user": user_data,
        "role": participant.role,
        "status": participant.status,
        "approved_at": participant.approved_at.isoformat() if participant.approved_at else None,
    }


def user_display_name(user):
    return (user.nickname or user.name) if user else "참여자"


@chat_bp.get("")
@jwt_required()
def rooms():
    user_id = int(get_jwt_identity())
    approved_meetings = (
        Meeting.query
        .options(joinedload(Meeting.chat_room))
        .outerjoin(Participant, Participant.meeting_id == Meeting.id)
        .filter(
            Meeting.status.notin_(["cancelled", "suspended"]),
            or_(
                Meeting.host_id == user_id,
                (Participant.user_id == user_id) & (Participant.status == "approved")
            )
        )
        .all()
    )
    missing_rooms = [ChatRoom(meeting_id=meeting.id) for meeting in approved_meetings if not meeting.chat_room]
    if missing_rooms:
        db.session.add_all(missing_rooms)
        db.session.commit()
    items = (
        ChatRoom.query.options(*ROOM_LIST_OPTIONS)
        .join(Meeting, ChatRoom.meeting_id == Meeting.id)
        .outerjoin(Participant, Participant.meeting_id == Meeting.id)
        .filter(
            Meeting.status.notin_(["cancelled", "suspended"]),
            or_(
                Meeting.host_id == user_id,
                (Participant.user_id == user_id) & (Participant.status == "approved")
            )
        )
        .distinct(ChatRoom.id)
        .all()
    )
    room_ids = [room.id for room in items]
    latest_by_room = {}
    unread_by_room = {}
    if room_ids:
        latest_ids = (
            db.session.query(func.max(ChatMessage.id).label("id"))
            .filter(ChatMessage.chat_room_id.in_(room_ids))
            .group_by(ChatMessage.chat_room_id)
            .subquery()
        )
        latest_messages = (
            ChatMessage.query
            .options(joinedload(ChatMessage.sender).joinedload(User.profile))
            .join(latest_ids, ChatMessage.id == latest_ids.c.id)
            .all()
        )
        latest_by_room = {message.chat_room_id: message for message in latest_messages}
        unread_rows = (
            db.session.query(ChatMessage.chat_room_id, func.count(ChatMessage.id))
            .outerjoin(
                ChatMessageRead,
                (ChatMessageRead.chat_message_id == ChatMessage.id)
                & (ChatMessageRead.user_id == user_id)
            )
            .filter(ChatMessage.chat_room_id.in_(room_ids))
            .filter(ChatMessage.user_id != user_id)
            .filter(ChatMessageRead.id.is_(None))
            .group_by(ChatMessage.chat_room_id)
            .all()
        )
        unread_by_room = {room_id: count for room_id, count in unread_rows}
    room_items = []
    for room in items:
        data = room.to_list_dict(latest_by_room.get(room.id))
        data["unread_count"] = unread_by_room.get(room.id, 0)
        room_items.append(data)
    return jsonify({"items": room_items})


@chat_bp.get("/<int:room_id>/messages")
@jwt_required()
def messages(room_id):
    user_id = int(get_jwt_identity())
    try:
        room = ensure_chat_access(room_id, user_id, include_messages=True)
        room_data = room.to_dict(current_user_id=user_id)
        participant = Participant.query.filter_by(meeting_id=room.meeting_id, user_id=user_id, status="approved").first()
        can_manage = bool(
            room.meeting
            and (
                room.meeting.host_id == user_id
                or (participant and participant.role in ["host", "cohost", "subhost", "assistant"])
            )
        )
        room_data["can_manage"] = can_manage
        if room_data.get("meeting"):
            room_data["meeting"]["can_manage"] = can_manage
        approved_participants = (
            Participant.query
            .options(joinedload(Participant.user).joinedload(User.profile))
            .filter_by(meeting_id=room.meeting_id, status="approved")
            .order_by(Participant.role.desc(), Participant.approved_at.asc(), Participant.requested_at.asc())
            .all()
        )
        room_data["participants"] = [participant_item(item) for item in approved_participants]
        ordered_messages = sorted(room.messages, key=lambda message: (message.created_at, message.id))
        mark_room_messages_read(room, user_id)
        attach_read_counts(ordered_messages)
        return jsonify({"room": room_data, "items": [message.to_dict() for message in ordered_messages]})
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403


@chat_bp.get("/direct")
@jwt_required()
def direct_rooms():
    user_id = int(get_jwt_identity())
    rooms = (
        DirectChatRoom.query
        .options(joinedload(DirectChatRoom.user_a).joinedload(User.profile), joinedload(DirectChatRoom.user_b).joinedload(User.profile), joinedload(DirectChatRoom.messages))
        .filter(or_(DirectChatRoom.user_a_id == user_id, DirectChatRoom.user_b_id == user_id))
        .order_by(DirectChatRoom.updated_at.desc().nullslast(), DirectChatRoom.created_at.desc().nullslast(), DirectChatRoom.id.desc())
        .all()
    )
    return jsonify({"items": [room.to_dict(current_user_id=user_id) for room in rooms]})


@chat_bp.post("/direct")
@jwt_required()
def create_direct_room():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    try:
        target_user_id = int(data.get("user_id"))
        room = get_or_create_direct_room(user_id, target_user_id)
        return jsonify({"room": room.to_dict(current_user_id=user_id)}), 201
    except (TypeError, ValueError) as error:
        return jsonify({"message": str(error)}), 400


@chat_bp.get("/direct/<int:room_id>/messages")
@jwt_required()
def direct_messages(room_id):
    user_id = int(get_jwt_identity())
    try:
        room = ensure_direct_room_access(room_id, user_id)
        ordered_messages = sorted(room.messages, key=lambda message: (message.created_at, message.id))
        return jsonify({"room": room.to_dict(current_user_id=user_id), "items": [message.to_dict() for message in ordered_messages]})
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403


@chat_bp.post("/direct/<int:room_id>/messages")
@jwt_required()
def create_direct_message(room_id):
    user_id = int(get_jwt_identity())
    try:
        message = send_direct_message(room_id, user_id, request.get_json() or {})
        return jsonify({"message": message.to_dict()}), 201
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403


@chat_bp.post("/<int:room_id>/messages")
@jwt_required()
def create_message(room_id):
    try:
        message = send_message(room_id, int(get_jwt_identity()), request.get_json() or {})
        return jsonify({"message": message.to_dict()}), 201
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403


@chat_bp.post("/<int:room_id>/leave")
@jwt_required()
def leave_room(room_id):
    user_id = int(get_jwt_identity())
    try:
        room = ensure_chat_access(room_id, user_id)
        if room.meeting and room.meeting.host_id == user_id:
            return jsonify({"message": "방장은 채팅방만 나갈 수 없습니다. 모임 관리에서 모임을 취소하거나 방장을 위임해주세요."}), 400
        participant = Participant.query.filter_by(meeting_id=room.meeting_id, user_id=user_id, status="approved").first()
        if not participant:
            return jsonify({"message": "이미 나간 채팅방입니다."}), 400
        participant.status = "cancelled"
        if room.meeting:
            room.meeting.current_participants = max(1, int(room.meeting.current_participants or 1) - 1)
            room.meeting.sync_status()
        db.session.add(ChatMessage(
            chat_room_id=room.id,
            user_id=user_id,
            content=f"{user_display_name(participant.user)}님이 나가셨습니다.",
            message_type="system",
        ))
        db.session.commit()
        return jsonify({"left": True, "meeting_id": room.meeting_id})
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403


@chat_bp.post("/mute")
@jwt_required()
def mute_chat_room():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    room_type = data.get("room_type", "meeting")
    room_id = data.get("room_id")
    if not room_id:
        return jsonify({"message": "채팅방 ID가 필요합니다."}), 400
    
    from app.utils.mute_store import mute_room
    mute_room(user_id, room_type, int(room_id))
    return jsonify({"success": True, "muted": True}), 200


@chat_bp.post("/unmute")
@jwt_required()
def unmute_chat_room():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    room_type = data.get("room_type", "meeting")
    room_id = data.get("room_id")
    if not room_id:
        return jsonify({"message": "채팅방 ID가 필요합니다."}), 400
    
    from app.utils.mute_store import unmute_room
    unmute_room(user_id, room_type, int(room_id))
    return jsonify({"success": True, "muted": False}), 200


@chat_bp.get("/muted")
@jwt_required()
def get_muted_chat_rooms():
    user_id = int(get_jwt_identity())
    from app.utils.mute_store import get_muted_rooms
    mutes = get_muted_rooms(user_id)
    return jsonify({"muted_rooms": mutes}), 200
