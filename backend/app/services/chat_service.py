from flask import current_app
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import ChatMessage, ChatRoom, Meeting, Participant, Sport, User
from app.services.notification_service import create_notification, send_web_push


def _room_options(include_messages=False):
    options = [
        joinedload(ChatRoom.meeting).joinedload(Meeting.host).joinedload(User.profile),
        joinedload(ChatRoom.meeting).joinedload(Meeting.sport).joinedload(Sport.category),
        joinedload(ChatRoom.meeting).joinedload(Meeting.participants),
    ]
    if include_messages:
        options.append(joinedload(ChatRoom.messages).joinedload(ChatMessage.sender).joinedload(User.profile))
    return options


def ensure_chat_access(room_id, user_id, include_messages=False):
    room = ChatRoom.query.options(*_room_options(include_messages)).get_or_404(room_id)
    if room.meeting and room.meeting.status == "suspended":
        raise PermissionError("폐쇄(비활성화) 처리된 모임의 채팅방입니다.")
    if room.meeting and room.meeting.host_id == user_id:
        return room
    participant = Participant.query.filter_by(meeting_id=room.meeting_id, user_id=user_id, status="approved").first()
    if not participant:
        raise PermissionError("승인된 참여자만 채팅방에 접근할 수 있습니다.")
    return room


def send_message(room_id, user_id, content):
    room = ensure_chat_access(room_id, user_id)
    sender = User.query.options(joinedload(User.profile)).get(user_id)

    # sender_name = sender.nickname if sender and sender.nickname else (sender.name if sender else "참여자")
    sender_name = sender.nickname or sender.name if sender else "참여자"
    
    meeting_title = room.meeting.title if room.meeting else "모임"
    message = ChatMessage(chat_room_id=room.id, user_id=user_id, content=content)
    db.session.add(message)

    participants = Participant.query.filter_by(meeting_id=room.meeting_id, status="approved").all()
    for participant in participants:
        if participant.user_id == user_id:
            continue
        create_notification(
            participant.user_id,
            "chat",
            f"{meeting_title} 새 채팅",
            f"{sender_name}님이 메시지를 보냈습니다. {content[:60]}",
            f"/chats/{room.id}",
            send_push=False
        )

    db.session.commit()
    for participant in participants:
        if participant.user_id != user_id:
            try:
                send_web_push(participant.user_id, f"{meeting_title} 새 채팅", f"{sender_name}님: {content[:60]}", f"/chats/{room.id}")
            except Exception as error:
                current_app.logger.warning("Chat push notification failed: %s", error)
    return message
