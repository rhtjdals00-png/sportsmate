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
    participant = Participant.query.filter_by(meeting_id=room.meeting_id, user_id=user_id, status="approved").first()
    if not participant:
        raise PermissionError("승인된 참여자만 채팅방에 접근할 수 있습니다.")
    return room


def send_message(room_id, user_id, content):
    room = ensure_chat_access(room_id, user_id)
    message = ChatMessage(chat_room_id=room.id, user_id=user_id, content=content)
    db.session.add(message)

    participants = Participant.query.filter_by(meeting_id=room.meeting_id, status="approved").all()
    for participant in participants:
        if participant.user_id == user_id:
            continue
        create_notification(participant.user_id, "chat", "새 채팅 메시지", content[:80], f"/chats/{room.id}", send_push=False)

    db.session.commit()
    for participant in participants:
        if participant.user_id != user_id:
            send_web_push(participant.user_id, "새 채팅 메시지", content[:80], f"/chats/{room.id}")
    return message
