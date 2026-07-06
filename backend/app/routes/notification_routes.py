import re
from datetime import timedelta

from flask import Blueprint, jsonify, request
from flask import current_app
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models import ChatMessage, ChatRoom, Meeting, Notification, Participant, PushSubscription

notification_bp = Blueprint("notifications", __name__)


def _display_name(user):
    if not user:
        return "알 수 없는 사용자"
    if user.nickname:
        return user.nickname
    return user.name or user.email or "알 수 없는 사용자"


def _enrich_notification(item, user_id):
    data = item.to_dict()
    if item.type == "chat" and item.link_url:
        match = re.search(r"/chats/(\d+)", item.link_url)
        if match:
            room_id = int(match.group(1))
            message = (
                ChatMessage.query
                .filter(ChatMessage.chat_room_id == room_id, ChatMessage.user_id != user_id)
                .filter(ChatMessage.created_at <= item.created_at + timedelta(seconds=10))
                .order_by(ChatMessage.created_at.desc())
                .first()
            )
            room = ChatRoom.query.get(room_id)
            meeting_title = room.meeting.title if room and room.meeting else "모임"
            if message:
                data["title"] = f"{meeting_title} 새 채팅"
                data["message"] = f"{_display_name(message.sender)}님이 메시지를 보냈습니다. {message.content[:60]}"
    if item.type == "join_request" and item.link_url:
        match = re.search(r"/host/meetings/(\d+)/applicants", item.link_url)
        if match:
            meeting_id = int(match.group(1))
            participant = (
                Participant.query
                .filter(Participant.meeting_id == meeting_id)
                .filter(Participant.requested_at <= item.created_at + timedelta(seconds=10))
                .order_by(Participant.requested_at.desc())
                .first()
            )
            meeting = Meeting.query.get(meeting_id)
            if participant and meeting:
                data["message"] = f"{_display_name(participant.user)}님이 {meeting.title}에 참여 신청을 보냈습니다."
    return data


@notification_bp.get("/notifications")
@jwt_required()
def notifications():
    user_id = int(get_jwt_identity())
    items = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).all()
    return jsonify({"items": [_enrich_notification(item, user_id) for item in items]})


@notification_bp.patch("/notifications/<int:notification_id>/read")
@jwt_required()
def read_notification(notification_id):
    item = Notification.query.filter_by(id=notification_id, user_id=int(get_jwt_identity())).first_or_404()
    item.is_read = True
    db.session.commit()
    return jsonify({"notification": item.to_dict()})


@notification_bp.get("/push-public-key")
def push_public_key():
    return jsonify({"publicKey": current_app.config.get("VAPID_PUBLIC_KEY", "")})


@notification_bp.post("/push-subscriptions")
@jwt_required()
def create_push_subscription():
    data = request.get_json() or {}
    user_id = int(get_jwt_identity())
    endpoint = data.get("endpoint", "")
    p256dh = data.get("keys", {}).get("p256dh", data.get("p256dh", ""))
    auth = data.get("keys", {}).get("auth", data.get("auth", ""))
    if not endpoint or not p256dh or not auth:
        return jsonify({"message": "푸시 구독 정보가 올바르지 않습니다."}), 400
    item = PushSubscription.query.filter_by(user_id=user_id, endpoint=endpoint).first()
    if item:
        item.p256dh = p256dh
        item.auth = auth
        item.user_agent = request.headers.get("User-Agent")
        item.is_active = True
    else:
        item = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            user_agent=request.headers.get("User-Agent")
        )
        db.session.add(item)
    db.session.commit()
    return jsonify({"subscription_id": item.id}), 201


@notification_bp.delete("/push-subscriptions/<int:subscription_id>")
@jwt_required()
def delete_push_subscription(subscription_id):
    item = PushSubscription.query.filter_by(id=subscription_id, user_id=int(get_jwt_identity())).first_or_404()
    item.is_active = False
    db.session.commit()
    return jsonify({"subscription_id": item.id, "is_active": item.is_active})
