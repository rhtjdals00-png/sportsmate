from datetime import datetime

from flask import current_app
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import ChatMessage, ChatMessageRead, ChatRoom, DirectChatMessage, DirectChatRoom, Meeting, Participant, Sport, User, UserBlock
from app.services.notification_service import create_notification, send_web_push
from app.utils.meeting_state import meeting_chat_is_read_only
from app.utils.timezone import kst_now


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
    if meeting_chat_is_read_only(room.meeting):
        raise PermissionError("마감된 모임의 채팅방은 읽기만 가능합니다.")
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

    sender_name = (getattr(sender, "display_nickname", None) or sender.nickname or sender.name) if sender else "참여자"
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
            getattr(reply_to_message.sender, "display_nickname", None) or reply_to_message.sender.nickname or reply_to_message.sender.name
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
            from app.utils.mute_store import is_muted
            if is_muted(participant.user_id, "meeting", room.id):
                continue
            try:
                send_web_push(participant.user_id, f"{meeting_title} 새 채팅", f"{sender_name}: {preview}", f"/chats/{room.id}")
            except Exception as error:
                current_app.logger.warning("Chat push notification failed: %s", error)
    return message


def mark_messages_read(messages, user_id):
    message_ids = [message.id for message in messages if message.user_id != user_id]
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


def mark_room_messages_read(room, user_id):
    mark_messages_read(room.messages, user_id)
    from app.models.notifications import Notification
    Notification.query.filter_by(user_id=user_id, type="chat", is_read=False).filter(Notification.link_url == f"/chats/{room.id}").update({"is_read": True}, synchronize_session=False)
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


def direct_contact_is_blocked(first_user_id, second_user_id):
    return UserBlock.query.filter(or_(
        and_(
            UserBlock.blocker_id == first_user_id,
            UserBlock.blocked_id == second_user_id,
        ),
        and_(
            UserBlock.blocker_id == second_user_id,
            UserBlock.blocked_id == first_user_id,
        ),
    )).first() is not None


def users_share_meeting(first_user_id, second_user_id):
    first_ids = {
        row[0] for row in db.session.query(Meeting.id)
        .outerjoin(Participant, Participant.meeting_id == Meeting.id)
        .filter(or_(
            Meeting.host_id == first_user_id,
            and_(
                Participant.user_id == first_user_id,
                Participant.status == "approved",
            ),
        ))
        .all()
    }

    if not first_ids:
        return False

    return db.session.query(Meeting.id).outerjoin(
        Participant,
        Participant.meeting_id == Meeting.id,
    ).filter(
        Meeting.id.in_(first_ids),
        or_(
            Meeting.host_id == second_user_id,
            and_(
                Participant.user_id == second_user_id,
                Participant.status == "approved",
            ),
        ),
    ).first() is not None


def direct_contact_action(current_user_id, target_user):
    if current_user_id == target_user.id:
        return "self"

    if direct_contact_is_blocked(current_user_id, target_user.id):
        return "blocked"

    user_a_id, user_b_id = sorted([current_user_id, target_user.id])
    active_room = DirectChatRoom.query.filter_by(
        user_a_id=user_a_id,
        user_b_id=user_b_id,
        is_active=True,
    ).first()

    if active_room:
        return "room"

    policy = target_user.direct_message_policy or "same_meeting"

    if policy == "none":
        return "denied"

    if users_share_meeting(current_user_id, target_user.id):
        return "room"

    if policy == "everyone":
        return "request"

    return "denied"


def _direct_chat_user_available(user):
    return bool(
        user
        and user.is_active
        and user.status == "active"
        and user.role not in {"suspended", "pending_withdrawal"}
    )


def get_or_create_direct_room(
    current_user_id,
    target_user_id,
    skip_policy=False,
):
    if current_user_id == target_user_id:
        raise ValueError("자기 자신과는 1:1 톡을 만들 수 없습니다.")
    target_user = User.query.get(target_user_id)
    if not target_user:
        raise ValueError("상대 사용자를 찾지 못했습니다.")
    if not _direct_chat_user_available(target_user):
        raise ValueError(
            "탈퇴하거나 이용할 수 없는 사용자에게는 새 1:1 대화를 시작할 수 없습니다."
        )

    if not skip_policy:
        action = direct_contact_action(current_user_id, target_user)

        if action == "blocked":
            raise PermissionError(
                "차단된 사용자와는 1:1 채팅을 시작할 수 없습니다."
            )

        if action == "denied":
            raise PermissionError(
                "상대방의 1:1 채팅 수신 설정으로 대화를 시작할 수 없습니다."
            )

        if action == "request":
            raise PermissionError(
                "먼저 1:1 대화 요청을 보내주세요."
            )
    user_a_id, user_b_id = sorted([current_user_id, target_user_id])
    room = DirectChatRoom.query.filter_by(user_a_id=user_a_id, user_b_id=user_b_id, is_active=True).first()
    if not room:
        room = DirectChatRoom(user_a_id=user_a_id, user_b_id=user_b_id)
        db.session.add(room)
        db.session.commit()
    return room


def ensure_direct_room_access(room_id, user_id):
    room = DirectChatRoom.query.get_or_404(room_id)
    if user_id not in {room.user_a_id, room.user_b_id}:
        raise PermissionError("1:1 톡방에 접근할 수 없습니다.")
    if room.has_left(user_id):
        raise PermissionError("나간 1:1 채팅방에는 다시 접근할 수 없습니다.")
    return room


def send_direct_message(room_id, user_id, data):
    room = ensure_direct_room_access(room_id, user_id)
    if not room.is_active:
        raise PermissionError("종료된 1:1 채팅방은 읽기만 가능합니다.")

    recipient_id = room.user_b_id if room.user_a_id == user_id else room.user_a_id

    if not _direct_chat_user_available(room.other_user(user_id)):
        raise ValueError("탈퇴한 사용자에게는 새 메시지를 보낼 수 없습니다.")

    if direct_contact_is_blocked(user_id, recipient_id):
        raise PermissionError("차단된 사용자와는 메시지를 주고받을 수 없습니다.")

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
    room.updated_at = kst_now()
    db.session.add(message)
    sender_name = sender.nickname or sender.name if sender else "참여자"
    preview = _notification_preview(message_type, message.content)
    create_notification(
        recipient_id,
        "direct_chat",
        f"{sender_name}님의 1:1 채팅",
        f"{sender_name}님이 메시지를 보냈습니다. {preview}",
        f"/chats/direct/{room.id}",
        send_push=False,
    )
    db.session.commit()
    from app.utils.mute_store import is_muted
    if not is_muted(recipient_id, "direct", room.id):
        try:
            send_web_push(
                recipient_id,
                f"{sender_name}님의 1:1 채팅",
                f"{sender_name}: {preview}",
                f"/chats/direct/{room.id}",
            )
        except Exception as error:
            current_app.logger.warning("Direct chat push notification failed: %s", error)
    return message
