from app.extensions import db
from app.models import ChatMessage, ChatRoom, Notification, Participant


def ensure_chat_access(room_id, user_id):
    room = ChatRoom.query.get_or_404(room_id)
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
        db.session.add(Notification(user_id=participant.user_id, type="chat", title="새 채팅 메시지", message=content[:80], link_url=f"/chats/{room.id}"))

    db.session.commit()
    return message

