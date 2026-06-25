from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models import ChatRoom
from app.services.chat_service import ensure_chat_access, send_message

chat_bp = Blueprint("chat", __name__)


@chat_bp.get("")
@jwt_required()
def rooms():
    user_id = int(get_jwt_identity())
    items = [room for room in ChatRoom.query.all() if any(p.user_id == user_id and p.status == "approved" for p in room.meeting.participants)]
    return jsonify({"items": [room.to_dict() for room in items]})


@chat_bp.get("/<int:room_id>/messages")
@jwt_required()
def messages(room_id):
    try:
        room = ensure_chat_access(room_id, int(get_jwt_identity()))
        return jsonify({"room": room.to_dict(), "items": [message.to_dict() for message in room.messages]})
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

