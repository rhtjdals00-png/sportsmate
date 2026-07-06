from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import ChatMessage, ChatRoom, Meeting, Participant, Sport, User
from app.services.chat_service import ensure_chat_access, send_message

chat_bp = Blueprint("chat", __name__)


ROOM_LIST_OPTIONS = (
    joinedload(ChatRoom.meeting).joinedload(Meeting.host),
    joinedload(ChatRoom.meeting).joinedload(Meeting.sport).joinedload(Sport.category),
    joinedload(ChatRoom.meeting).joinedload(Meeting.chat_room),
)


@chat_bp.get("")
@jwt_required()
def rooms():
    user_id = int(get_jwt_identity())
    approved_meetings = (
        Meeting.query
        .options(joinedload(Meeting.chat_room))
        .outerjoin(Participant, Participant.meeting_id == Meeting.id)
        .filter(
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
    return jsonify({"items": [room.to_list_dict(latest_by_room.get(room.id)) for room in items]})


@chat_bp.get("/<int:room_id>/messages")
@jwt_required()
def messages(room_id):
    user_id = int(get_jwt_identity())
    try:
        room = ensure_chat_access(room_id, user_id, include_messages=True)
        return jsonify({"room": room.to_dict(current_user_id=user_id), "items": [message.to_dict() for message in room.messages]})
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403


@chat_bp.post("/<int:room_id>/messages")
@jwt_required()
def create_message(room_id):
    try:
        message = send_message(room_id, int(get_jwt_identity()), (request.get_json() or {}).get("content", ""))
        return jsonify({"message": message.to_dict()}), 201
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403
