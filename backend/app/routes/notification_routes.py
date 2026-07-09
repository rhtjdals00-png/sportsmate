import re
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask import current_app
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import ChatMessage, ChatMessageRead, ChatRoom, Meeting, Notice, Notification, Participant, PushSubscription, Vote, VoteResponse
from app.utils.timezone import kst_now, to_kst_iso

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


def _to_kst_iso(value):
    return to_kst_iso(value)


def _notification_item(item):
    data = item.to_dict()
    data["source"] = "admin"
    return data


def _chat_summary_items(user_id):
    rooms = (
        ChatRoom.query
        .options(joinedload(ChatRoom.meeting))
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
    room_ids = [room.id for room in rooms]
    if not room_ids:
        return []

    unread_rows = (
        db.session.query(ChatMessage.chat_room_id, func.count(ChatMessage.id), func.max(ChatMessage.id))
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
    latest_ids = [latest_id for _, _, latest_id in unread_rows if latest_id]
    latest_by_id = {}
    if latest_ids:
        latest_by_id = {
            message.id: message
            for message in ChatMessage.query.filter(ChatMessage.id.in_(latest_ids)).all()
        }
    room_by_id = {room.id: room for room in rooms}
    items = []
    for room_id, count, latest_id in unread_rows:
        room = room_by_id.get(room_id)
        latest = latest_by_id.get(latest_id)
        if not room or not latest:
            continue
        items.append({
            "id": f"chat-{room_id}",
            "type": "chat",
            "source": "chat",
            "title": "새로운 채팅이 있습니다",
            "message": f"{room.meeting.title if room.meeting else '채팅방'}에 새 채팅이 있습니다.",
            "link_url": f"/chats/{room_id}",
            "is_read": False,
            "created_at": _to_kst_iso(latest.created_at),
        })
    return items


def _notice_summary_items(user_id):
    since = kst_now() - timedelta(days=7)
    notices = (
        Notice.query
        .join(Meeting, Notice.meeting_id == Meeting.id)
        .outerjoin(Participant, Participant.meeting_id == Meeting.id)
        .outerjoin(ChatRoom, ChatRoom.meeting_id == Meeting.id)
        .filter(
            Notice.created_at >= since,
            Meeting.status.notin_(["cancelled", "suspended"]),
            or_(
                Meeting.host_id == user_id,
                (Participant.user_id == user_id) & (Participant.status == "approved")
            )
        )
        .order_by(Notice.created_at.desc())
        .limit(5)
        .all()
    )
    items = []
    for notice in notices:
        meeting = Meeting.query.get(notice.meeting_id)
        chat_room_id = meeting.chat_room.id if meeting and meeting.chat_room else None
        items.append({
            "id": f"notice-{notice.id}",
            "type": "notice",
            "source": "notice",
            "title": "공지사항이 있습니다",
            "message": f"{meeting.title if meeting else '모임'}에 공지사항이 등록되었습니다.",
            "link_url": f"/chats/{chat_room_id}" if chat_room_id else "/chats",
            "is_read": False,
            "created_at": _to_kst_iso(notice.created_at),
        })
    return items


def _vote_summary_items(user_id):
    now = kst_now()
    deadline = now + timedelta(hours=24)
    votes = (
        Vote.query
        .join(Meeting, Vote.meeting_id == Meeting.id)
        .outerjoin(Participant, Participant.meeting_id == Meeting.id)
        .outerjoin(
            VoteResponse,
            (VoteResponse.vote_id == Vote.id) & (VoteResponse.user_id == user_id)
        )
        .filter(
            Vote.ends_at.isnot(None),
            Vote.ends_at >= now,
            Vote.ends_at <= deadline,
            VoteResponse.id.is_(None),
            Meeting.status.notin_(["cancelled", "suspended"]),
            or_(
                Meeting.host_id == user_id,
                (Participant.user_id == user_id) & (Participant.status == "approved")
            )
        )
        .order_by(Vote.ends_at.asc())
        .limit(5)
        .all()
    )
    items = []
    for vote in votes:
        meeting = Meeting.query.get(vote.meeting_id)
        chat_room_id = meeting.chat_room.id if meeting and meeting.chat_room else None
        items.append({
            "id": f"vote-{vote.id}",
            "type": "vote",
            "source": "vote",
            "title": "마감 임박 투표가 있습니다",
            "message": f"{meeting.title if meeting else '모임'}: {vote.title}",
            "link_url": f"/chats/{chat_room_id}" if chat_room_id else "/chats",
            "is_read": False,
            "created_at": _to_kst_iso(vote.ends_at),
        })
    return items


@notification_bp.get("/notifications")
@jwt_required()
def notifications():
    user_id = int(get_jwt_identity())
    items = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).all()
    return jsonify({"items": [_enrich_notification(item, user_id) for item in items]})


@notification_bp.get("/notifications/summary")
@jwt_required()
def notification_summary():
    user_id = int(get_jwt_identity())
    stored = (
        Notification.query
        .filter_by(user_id=user_id, is_read=False)
        .filter(Notification.type != "chat")
        .order_by(Notification.created_at.desc())
        .limit(5)
        .all()
    )
    items = (
        [_notification_item(item) for item in stored]
        + _chat_summary_items(user_id)
        + _notice_summary_items(user_id)
        + _vote_summary_items(user_id)
    )
    items.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return jsonify({
        "unread_count": len(items),
        "items": items[:12],
    })


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
