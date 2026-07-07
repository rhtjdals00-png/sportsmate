from datetime import datetime

from flask import current_app
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import ChatMessage, ChatMessageRead, ChatRoom, DirectChatMessage, DirectChatRoom, Meeting, Participant, Sport, User
from app.services.notification_service import create_notification, send_web_push


def _room_options(include_messages=False):
    options = [
        joinedload(ChatRoom.meeting).joinedload(Meeting.host).joinedload(User.profile),
        joinedload(ChatRoom.meeting).joinedload(Meeting.sport).joinedload(Sport.category),
        joinedload(ChatRoom.meeting).joinedload(Meeting.participants),
    ]
    if include_messages:
        options.append(joinedload(ChatRoom.messages).joinedload(ChatMessage.sender).joinedload(User.profile))
        options.append(
            joinedload(ChatRoom.messages)
            .joinedload(ChatMessage.reply_to)
            .joinedload(ChatMessage.sender)
            .joinedload(User.profile)
        )
    return options


def ensure_chat_access(room_id, user_id, include_messages=False):
    room = ChatRoom.query.options(*_room_options(include_messages)).get_or_404(room_id)
    if room.meeting and room.meeting.status in {"cancelled", "suspended"}:
        raise PermissionError("종료된 모임의 채팅방입니다.")
    if room.meeting and room.meeting.host_id == user_id:
        return room
    participant = Participant.query.filter_by(meeting_id=room.meeting_id, user_id=user_id, status="approved").first()
    if not participant:
        raise PermissionError("승인된 참여자만 채팅방에 접근할 수 있습니다.")
    return room


def _coerce_float(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _notification_preview(message_type, content):
    if message_type == "image":
        return "사진을 보냈습니다."
    if message_type == "location":
        return "위치를 공유했습니다."
    return content[:60]


def reply_preview(message):
    if message.message_type == "image":
        return message.attachment_name or "사진"
    if message.message_type == "location":
        return message.location_label or "공유한 위치"
    return message.content or ""


def send_message(room_id, user_id, data):
    room = ensure_chat_access(room_id, user_id)
    sender = User.query.options(joinedload(User.profile)).get(user_id)
    if not isinstance(data, dict):
        data = {"content": str(data or "")}

    message_type = data.get("message_type") or "text"
    content = (data.get("content") or "").strip()
    attachment_url = data.get("attachment_url")
    attachment_name = (data.get("attachment_name") or "").strip() or None
    location = data.get("location") or {}
    location_latitude = _coerce_float(location.get("latitude", data.get("location_latitude")))
    location_longitude = _coerce_float(location.get("longitude", data.get("location_longitude")))
    location_label = (location.get("label", data.get("location_label")) or "").strip() or None
    reply_to_message_id = data.get("reply_to_message_id")

    if message_type not in {"text", "image", "location"}:
        raise ValueError("지원하지 않는 메시지 형식입니다.")
    if message_type == "text" and not content:
        raise ValueError("메시지를 입력해주세요.")
    if message_type == "image" and not attachment_url:
        raise ValueError("전송할 사진을 선택해주세요.")
    if message_type == "location":
        if location_latitude is None or location_longitude is None:
            raise ValueError("공유할 위치를 확인하지 못했습니다.")
        content = content or (location_label or "위치를 공유했습니다.")

    reply_to_message = None
    if reply_to_message_id:
        reply_to_message = ChatMessage.query.filter_by(id=reply_to_message_id, chat_room_id=room.id).first()
        if reply_to_message and reply_to_message.message_type == "notice":
            raise ValueError("공지 메시지에는 답장할 수 없습니다.")
        if not reply_to_message:
            raise ValueError("답장할 메시지를 찾지 못했습니다.")

    sender_name = sender.nickname or sender.name if sender else "참여자"
    meeting_title = room.meeting.title if room.meeting else "모임"
    message = ChatMessage(
        chat_room_id=room.id,
        user_id=user_id,
        content=content or ("사진" if message_type == "image" else ""),
        message_type=message_type,
        attachment_url=attachment_url,
        attachment_name=attachment_name,
        location_latitude=location_latitude,
        location_longitude=location_longitude,
        location_label=location_label,
        reply_to_message_id=reply_to_message.id if reply_to_message else None,
        reply_to_user_id=reply_to_message.user_id if reply_to_message else None,
        reply_to_sender_name=(
            reply_to_message.sender.nickname or reply_to_message.sender.name
            if reply_to_message and reply_to_message.sender
            else None
        ),
        reply_to_content=reply_preview(reply_to_message) if reply_to_message else None,
        reply_to_message_type=reply_to_message.message_type if reply_to_message else None,
    )
    db.session.add(message)

    preview = _notification_preview(message_type, message.content)
    participants = Participant.query.filter_by(meeting_id=room.meeting_id, status="approved").all()
    for participant in participants:
        if participant.user_id == user_id:
            continue
        create_notification(
            participant.user_id,
            "chat",
            f"{meeting_title} 새 채팅",
            f"{sender_name}님이 메시지를 보냈습니다. {preview}",
            f"/chats/{room.id}",
            send_push=False,
        )

    db.session.commit()
    for participant in participants:
        if participant.user_id != user_id:
            try:
                send_web_push(participant.user_id, f"{meeting_title} 새 채팅", f"{sender_name}: {preview}", f"/chats/{room.id}")
            except Exception as error:
                current_app.logger.warning("Chat push notification failed: %s", error)
    return message


def mark_room_messages_read(room, user_id):
    message_ids = [message.id for message in room.messages if message.user_id != user_id]
    if not message_ids:
        return
    existing_ids = {
        row.chat_message_id
        for row in ChatMessageRead.query
        .filter(ChatMessageRead.user_id == user_id)
        .filter(ChatMessageRead.chat_message_id.in_(message_ids))
        .all()
    }
    db.session.add_all(
        ChatMessageRead(chat_message_id=message_id, user_id=user_id)
        for message_id in message_ids
        if message_id not in existing_ids
    )
    db.session.commit()


def attach_read_counts(messages):
    message_ids = [message.id for message in messages]
    if not message_ids:
        return
    rows = (
        db.session.query(ChatMessageRead.chat_message_id, func.count(ChatMessageRead.id))
        .join(ChatMessage, ChatMessage.id == ChatMessageRead.chat_message_id)
        .filter(ChatMessageRead.chat_message_id.in_(message_ids))
        .filter(ChatMessageRead.user_id != ChatMessage.user_id)
        .group_by(ChatMessageRead.chat_message_id)
        .all()
    )
    counts = {message_id: count for message_id, count in rows}
    for message in messages:
        message._read_count = counts.get(message.id, 0)


def get_or_create_direct_room(current_user_id, target_user_id):
    if current_user_id == target_user_id:
        raise ValueError("자기 자신과는 1:1 톡을 만들 수 없습니다.")
    if not User.query.get(target_user_id):
        raise ValueError("상대 사용자를 찾지 못했습니다.")
    user_a_id, user_b_id = sorted([current_user_id, target_user_id])
    room = DirectChatRoom.query.filter_by(user_a_id=user_a_id, user_b_id=user_b_id).first()
    if not room:
        room = DirectChatRoom(user_a_id=user_a_id, user_b_id=user_b_id)
        db.session.add(room)
        db.session.commit()
    return room


def ensure_direct_room_access(room_id, user_id):
    room = DirectChatRoom.query.get_or_404(room_id)
    if user_id not in {room.user_a_id, room.user_b_id}:
        raise PermissionError("1:1 톡방에 접근할 수 없습니다.")
    return room


def send_direct_message(room_id, user_id, data):
    room = ensure_direct_room_access(room_id, user_id)
    if not isinstance(data, dict):
        data = {"content": str(data or "")}
    message_type = data.get("message_type") or "text"
    content = (data.get("content") or "").strip()
    attachment_url = data.get("attachment_url")
    attachment_name = (data.get("attachment_name") or "").strip() or None
    location = data.get("location") or {}
    location_latitude = _coerce_float(location.get("latitude", data.get("location_latitude")))
    location_longitude = _coerce_float(location.get("longitude", data.get("location_longitude")))
    location_label = (location.get("label", data.get("location_label")) or "").strip() or None

    if message_type not in {"text", "image", "location"}:
        raise ValueError("지원하지 않는 메시지 형식입니다.")
    if message_type == "text" and not content:
        raise ValueError("메시지를 입력해주세요.")
    if message_type == "image" and not attachment_url:
        raise ValueError("전송할 사진을 선택해주세요.")
    if message_type == "location":
        if location_latitude is None or location_longitude is None:
            raise ValueError("공유할 위치를 확인하지 못했습니다.")
        content = content or (location_label or "위치를 공유했습니다.")

    message = DirectChatMessage(
        direct_chat_room_id=room.id,
        sender_id=user_id,
        content=content or ("사진" if message_type == "image" else "위치를 공유했습니다."),
        message_type=message_type,
        attachment_url=attachment_url,
        attachment_name=attachment_name,
        location_latitude=location_latitude,
        location_longitude=location_longitude,
        location_label=location_label,
    )
    room.updated_at = datetime.utcnow()
    db.session.add(message)
    db.session.commit()
    return message
