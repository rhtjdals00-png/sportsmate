from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import ChatMessage, ChatMessageRead, ChatRoom, DirectChatMessage, DirectChatRequest, DirectChatRoom, Meeting, Participant, Sport, User, UserBlock
from app.services.chat_service import (
    attach_read_counts,
    ensure_chat_access,
    ensure_direct_room_access,
    direct_contact_action,
    direct_contact_is_blocked,
    get_or_create_direct_room,
    mark_messages_read,
    mark_room_messages_read,
    send_direct_message,
    send_message,
)
from app.services.meeting_service import get_meeting_for_update, get_participant_for_update, recalculate_current_participants
from app.services.notification_service import create_notification
from app.utils.meeting_state import meeting_chat_is_read_only
from app.utils.timezone import kst_now

chat_bp = Blueprint("chat", __name__)


ROOM_LIST_OPTIONS = (
    joinedload(ChatRoom.meeting).joinedload(Meeting.host),
    joinedload(ChatRoom.meeting).joinedload(Meeting.sport).joinedload(Sport.category),
    joinedload(ChatRoom.meeting).joinedload(Meeting.chat_room),
)

CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024
CHAT_IMAGE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}


def pagination_args():
    requested = any(name in request.args for name in ("limit", "before_id", "after_id"))
    if not requested:
        return None
    try:
        limit = min(max(int(request.args.get("limit", 50)), 1), 200)
        before_id = int(request.args["before_id"]) if request.args.get("before_id") else None
        after_id = int(request.args["after_id"]) if request.args.get("after_id") else None
    except (TypeError, ValueError):
        raise ValueError("limit, before_id, after_id must be integers.")
    if before_id and after_id:
        raise ValueError("before_id and after_id cannot be used together.")
    return limit, before_id, after_id


def page_messages(query, model, limit, before_id=None, after_id=None):
    if after_id:
        rows = query.filter(model.id > after_id).order_by(model.id.asc()).limit(limit + 1).all()
        return rows[:limit], len(rows) > limit
    if before_id:
        query = query.filter(model.id < before_id)
    rows = query.order_by(model.id.desc()).limit(limit + 1).all()
    return list(reversed(rows[:limit])), len(rows) > limit


def storage_headers(secret_key):
    headers = {"apikey": secret_key}
    if secret_key.count(".") == 2:
        headers["Authorization"] = f"Bearer {secret_key}"
    return headers


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


def approved_chat_participants(meeting_id):
    participants = (
        Participant.query
        .options(joinedload(Participant.user).joinedload(User.profile))
        .filter_by(meeting_id=meeting_id, status="approved")
        .order_by(Participant.role.desc(), Participant.approved_at.asc(), Participant.requested_at.asc())
        .all()
    )
    return [participant_item(participant) for participant in participants]


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
        read_only = meeting_chat_is_read_only(room.meeting)
        data["is_read_only"] = read_only
        data["chat_status_label"] = "마감된 모임" if read_only else "진행 중"
        if data.get("meeting"):
            data["meeting"]["is_chat_read_only"] = read_only
            data["meeting"]["chat_status_label"] = data["chat_status_label"]
        data["unread_count"] = unread_by_room.get(room.id, 0)
        room_items.append(data)
    return jsonify({"items": room_items})


@chat_bp.post("/uploads")
@jwt_required()
def upload_chat_image():
    user_id = int(get_jwt_identity())
    uploaded_file = request.files.get("file")
    room_type = (request.form.get("room_type") or "").strip().lower()
    try:
        room_id = int(request.form.get("room_id"))
    except (TypeError, ValueError):
        return jsonify({"message": "채팅방을 확인해주세요."}), 400

    if room_type == "meeting":
        room = ensure_chat_access(room_id, user_id)
        if meeting_chat_is_read_only(room.meeting):
            return jsonify({"message": "종료된 채팅방에는 사진을 보낼 수 없습니다."}), 403
    elif room_type == "direct":
        ensure_direct_room_access(room_id, user_id)
    else:
        return jsonify({"message": "지원하지 않는 채팅방 형식입니다."}), 400

    if not uploaded_file:
        return jsonify({"message": "업로드할 사진을 선택해주세요."}), 400
    extension = CHAT_IMAGE_EXTENSIONS.get(uploaded_file.mimetype)
    if not extension:
        return jsonify({"message": "JPG, PNG, WEBP, GIF 이미지만 업로드할 수 있습니다."}), 400
    payload = uploaded_file.stream.read(CHAT_IMAGE_MAX_BYTES + 1)
    if len(payload) > CHAT_IMAGE_MAX_BYTES:
        return jsonify({"message": "사진은 5MB 이하만 업로드할 수 있습니다."}), 400

    supabase_url = current_app.config.get("SUPABASE_URL", "").rstrip("/")
    secret_key = current_app.config.get("SUPABASE_SERVICE_ROLE_KEY", "")
    bucket = current_app.config.get("SUPABASE_CHAT_BUCKET", "chat-images")
    if not supabase_url or not secret_key:
        return jsonify({"message": "사진 저장소 설정이 완료되지 않았습니다."}), 503

    object_path = f"{room_type}/{room_id}/{user_id}/{uuid4().hex}.{extension}"
    encoded_path = quote(object_path, safe="/")
    headers = storage_headers(secret_key)
    headers.update({"Content-Type": uploaded_file.mimetype, "x-upsert": "false"})
    upload_request = Request(
        f"{supabase_url}/storage/v1/object/{bucket}/{encoded_path}",
        data=payload,
        headers=headers,
        method="POST",
    )
    try:
        with urlopen(upload_request, timeout=30) as response:
            status_code = response.status
    except HTTPError as error:
        current_app.logger.warning("Chat image upload failed with status %s", error.code)
        return jsonify({"message": "사진 업로드에 실패했습니다."}), 502
    except (URLError, TimeoutError) as error:
        current_app.logger.warning("Chat image upload request failed: %s", error)
        return jsonify({"message": "사진 저장소에 연결하지 못했습니다."}), 502
    if not 200 <= status_code < 300:
        current_app.logger.warning("Chat image upload failed with status %s", status_code)
        return jsonify({"message": "사진 업로드에 실패했습니다."}), 502

    public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{encoded_path}"
    return jsonify({
        "attachment_url": public_url,
        "attachment_name": (uploaded_file.filename or "chat-image")[:255],
        "object_path": object_path,
    }), 201


@chat_bp.get("/<int:room_id>/messages")
@jwt_required()
def messages(room_id):
    user_id = int(get_jwt_identity())
    try:
        page = pagination_args()
        room = ensure_chat_access(room_id, user_id, include_messages=page is None)
        if page is None:
            room_data = room.to_dict(current_user_id=user_id)
            room_data["participants"] = approved_chat_participants(room.meeting_id)
            ordered_messages = sorted(room.messages, key=lambda message: (message.created_at, message.id))
            read_ids = {
                row.chat_message_id
                for row in ChatMessageRead.query
                .filter_by(user_id=user_id)
                .join(ChatMessage, ChatMessage.id == ChatMessageRead.chat_message_id)
                .filter(ChatMessage.chat_room_id == room.id)
                .all()
            }
            first_unread = next(
                (
                    message
                    for message in ordered_messages
                    if message.user_id != user_id and message.id not in read_ids
                ),
                None
            )
            room_data["first_unread_message_id"] = first_unread.id if first_unread else None
            mark_room_messages_read(room, user_id)
            attach_read_counts(ordered_messages)
            return jsonify({"room": room_data, "items": [message.to_dict() for message in ordered_messages]})

        limit, before_id, after_id = page
        message_query = (
            ChatMessage.query
            .options(
                joinedload(ChatMessage.sender).joinedload(User.profile),
                joinedload(ChatMessage.reply_to).joinedload(ChatMessage.sender).joinedload(User.profile),
            )
            .filter(ChatMessage.chat_room_id == room.id)
        )
        ordered_messages, has_more = page_messages(
            message_query, ChatMessage, limit, before_id=before_id, after_id=after_id
        )
        first_unread = None
        if not after_id:
            first_unread = (
                ChatMessage.query
                .outerjoin(
                    ChatMessageRead,
                    and_(ChatMessageRead.chat_message_id == ChatMessage.id, ChatMessageRead.user_id == user_id),
                )
                .filter(ChatMessage.chat_room_id == room.id)
                .filter(ChatMessage.user_id != user_id)
                .filter(ChatMessageRead.id.is_(None))
                .order_by(ChatMessage.id.asc())
                .first()
            )
        mark_messages_read(ordered_messages, user_id)
        attach_read_counts(ordered_messages)
        response = {
            "items": [message.to_dict() for message in ordered_messages],
            "has_more": has_more,
            "latest_id": ordered_messages[-1].id if ordered_messages else after_id,
            "next_before_id": ordered_messages[0].id if has_more and ordered_messages else None,
        }
        if after_id:
            return jsonify(response)

        participant = Participant.query.filter_by(meeting_id=room.meeting_id, user_id=user_id, status="approved").first()
        can_manage = bool(
            room.meeting
            and (
                room.meeting.host_id == user_id
                or (participant and participant.role in ["host", "cohost", "subhost", "assistant"])
            )
        )
        meeting_data = room.meeting.to_dict(current_user_id=user_id) if room.meeting else None
        room_data = {
            "id": room.id,
            "meeting": meeting_data,
            "is_read_only": meeting_chat_is_read_only(room.meeting),
            "last_message": None,
            "unread_count": 0,
            "can_manage": can_manage,
        }
        if room_data.get("meeting"):
            room_data["meeting"]["can_manage"] = can_manage
        room_data["participants"] = approved_chat_participants(room.meeting_id)
        room_data["first_unread_message_id"] = first_unread.id if first_unread else None
        response["room"] = room_data
        return jsonify(response)
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403


@chat_bp.get("/direct")
@jwt_required()
def direct_rooms():
    user_id = int(get_jwt_identity())
    rooms = (
        DirectChatRoom.query
        .options(joinedload(DirectChatRoom.user_a).joinedload(User.profile), joinedload(DirectChatRoom.user_b).joinedload(User.profile), joinedload(DirectChatRoom.messages))
        .filter(or_(
            and_(DirectChatRoom.user_a_id == user_id, DirectChatRoom.user_a_left_at.is_(None)),
            and_(DirectChatRoom.user_b_id == user_id, DirectChatRoom.user_b_left_at.is_(None)),
        ))
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
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403


def direct_tag_user_payload(target, action, request_id=None):
    payload = {
        "id": target.id,
        "nickname": target.nickname,
        "user_tag": target.user_tag,
        "profile_image_url": target.profile_image_url,
        "region": target.profile.region if target.profile else "",
        "bio": target.profile.bio if target.profile else "",
        "contact_action": action,
    }
    if request_id:
        payload["request_id"] = request_id
    return payload


@chat_bp.get("/direct/by-tag")
@jwt_required()
def find_direct_user_by_tag():
    user_id = int(get_jwt_identity())
    tag = (request.args.get("tag") or "").strip().lstrip("#")
    if not tag:
        return jsonify({"message": "사용자 태그를 입력해주세요."}), 400
    target = User.query.options(joinedload(User.profile)).filter_by(user_tag=tag, is_active=True).first()
    if not target or target.id == user_id or direct_contact_is_blocked(user_id, target.id):
        return jsonify({"message": "일치하는 사용자를 찾지 못했습니다."}), 404
    action = direct_contact_action(user_id, target)
    pending = DirectChatRequest.query.filter(
        DirectChatRequest.status == "pending",
        or_(
            and_(DirectChatRequest.sender_id == user_id, DirectChatRequest.recipient_id == target.id),
            and_(DirectChatRequest.sender_id == target.id, DirectChatRequest.recipient_id == user_id),
        ),
    ).first()
    if pending:
        action = "request_pending" if pending.sender_id == user_id else "request_received"
    return jsonify({"user": direct_tag_user_payload(target, action, pending.id if pending else None)})


@chat_bp.post("/direct/by-tag")
@jwt_required()
def contact_direct_user_by_tag():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    tag = (data.get("tag") or "").strip().lstrip("#")
    target = User.query.options(joinedload(User.profile)).filter_by(user_tag=tag, is_active=True).first()
    if not target or target.id == user_id:
        return jsonify({"message": "일치하는 사용자를 찾지 못했습니다."}), 404
    action = direct_contact_action(user_id, target)
    if action == "blocked":
        return jsonify({"message": "차단된 사용자에게는 대화를 요청할 수 없습니다."}), 403
    if action == "denied":
        return jsonify({"message": "상대방의 1:1 채팅 수신 설정으로 대화를 시작할 수 없습니다."}), 403
    if action == "room":
        room = get_or_create_direct_room(user_id, target.id)
        return jsonify({"kind": "room", "room": room.to_dict(current_user_id=user_id)}), 201

    reverse_request = DirectChatRequest.query.filter_by(
        sender_id=target.id, recipient_id=user_id, status="pending"
    ).first()
    if reverse_request:
        return jsonify({"message": "상대방이 보낸 대화 요청을 먼저 확인해주세요."}), 409

    message = (data.get("message") or "").strip()[:500]
    existing = DirectChatRequest.query.filter_by(
        sender_id=user_id, recipient_id=target.id, status="pending"
    ).first()
    if existing:
        return jsonify({"message": "이미 보낸 대화 요청이 있습니다.", "request": existing.to_dict(user_id)}), 409
    chat_request = DirectChatRequest(
        sender_id=user_id,
        recipient_id=target.id,
        message=message,
    )
    db.session.add(chat_request)
    sender = User.query.get(user_id)
    create_notification(
        target.id,
        "direct_chat_request",
        "새로운 1:1 대화 요청",
        f"{sender.nickname if sender else '사용자'}님이 대화를 요청했습니다.",
        "/chats?tab=direct&panel=requests",
        commit=False,
        send_push=True,
    )
    db.session.commit()
    return jsonify({"kind": "request", "request": chat_request.to_dict(user_id)}), 201


@chat_bp.get("/direct/requests")
@jwt_required()
def direct_chat_requests():
    user_id = int(get_jwt_identity())
    requests = (
        DirectChatRequest.query
        .options(
            joinedload(DirectChatRequest.sender).joinedload(User.profile),
            joinedload(DirectChatRequest.recipient).joinedload(User.profile),
        )
        .filter(
            DirectChatRequest.status == "pending",
            or_(DirectChatRequest.sender_id == user_id, DirectChatRequest.recipient_id == user_id),
        )
        .order_by(DirectChatRequest.created_at.desc(), DirectChatRequest.id.desc())
        .all()
    )
    return jsonify({"items": [item.to_dict(user_id) for item in requests]})


@chat_bp.post("/direct/requests/<int:request_id>/respond")
@jwt_required()
def respond_direct_chat_request(request_id):
    user_id = int(get_jwt_identity())
    chat_request = DirectChatRequest.query.get_or_404(request_id)
    if chat_request.recipient_id != user_id or chat_request.status != "pending":
        return jsonify({"message": "처리할 수 없는 대화 요청입니다."}), 403
    action = (request.get_json() or {}).get("action")
    if action not in {"accept", "reject"}:
        return jsonify({"message": "요청 처리 방식을 확인해주세요."}), 400
    chat_request.status = "accepted" if action == "accept" else "rejected"
    chat_request.responded_at = kst_now()
    room = None
    if action == "accept":
        if direct_contact_is_blocked(user_id, chat_request.sender_id):
            return jsonify({"message": "차단된 사용자의 요청은 수락할 수 없습니다."}), 403
        room = get_or_create_direct_room(user_id, chat_request.sender_id, skip_policy=True)
        create_notification(
            chat_request.sender_id,
            "direct_chat_request",
            "1:1 대화 요청이 수락되었습니다",
            "상대방이 대화 요청을 수락했습니다.",
            f"/chats/direct/{room.id}",
            commit=False,
            send_push=True,
        )
    else:
        create_notification(
            chat_request.sender_id,
            "direct_chat_request",
            "1:1 대화 요청이 거절되었습니다",
            "상대방이 대화 요청을 거절했습니다.",
            "/chats?tab=direct&panel=requests",
            commit=False,
            send_push=True,
        )
    db.session.commit()
    return jsonify({
        "request": chat_request.to_dict(user_id),
        "room": room.to_dict(current_user_id=user_id) if room else None,
    })


@chat_bp.post("/direct/blocks/<int:target_user_id>")
@jwt_required()
def block_direct_user(target_user_id):
    user_id = int(get_jwt_identity())
    if target_user_id == user_id or not User.query.get(target_user_id):
        return jsonify({"message": "차단할 사용자를 확인해주세요."}), 400
    block = UserBlock.query.filter_by(blocker_id=user_id, blocked_id=target_user_id).first()
    if not block:
        db.session.add(UserBlock(blocker_id=user_id, blocked_id=target_user_id))
    user_a_id, user_b_id = sorted([user_id, target_user_id])
    active_room = DirectChatRoom.query.filter_by(
        user_a_id=user_a_id, user_b_id=user_b_id, is_active=True
    ).first()
    if active_room:
        active_room.end(user_id)
        active_room.updated_at = active_room.ended_at
        db.session.add(DirectChatMessage(
            direct_chat_room_id=active_room.id,
            sender_id=user_id,
            content="상대방이 채팅방을 나갔습니다.",
            message_type="system",
            created_at=active_room.ended_at,
        ))
    DirectChatRequest.query.filter(
        DirectChatRequest.status == "pending",
        or_(
            and_(DirectChatRequest.sender_id == user_id, DirectChatRequest.recipient_id == target_user_id),
            and_(DirectChatRequest.sender_id == target_user_id, DirectChatRequest.recipient_id == user_id),
        ),
    ).update({"status": "rejected", "responded_at": kst_now()}, synchronize_session=False)
    db.session.commit()
    return jsonify({"blocked": True, "user_id": target_user_id})


@chat_bp.get("/direct/blocks")
@jwt_required()
def direct_blocked_users():
    user_id = int(get_jwt_identity())
    blocks = (
        UserBlock.query
        .options(joinedload(UserBlock.blocked).joinedload(User.profile))
        .filter_by(blocker_id=user_id)
        .order_by(UserBlock.created_at.desc(), UserBlock.id.desc())
        .all()
    )
    return jsonify({"items": [
        {
            "id": block.blocked.id,
            "nickname": block.blocked.nickname,
            "user_tag": block.blocked.user_tag,
            "profile_image_url": block.blocked.profile_image_url,
        }
        for block in blocks if block.blocked
    ]})


@chat_bp.delete("/direct/blocks/<int:target_user_id>")
@jwt_required()
def unblock_direct_user(target_user_id):
    user_id = int(get_jwt_identity())
    UserBlock.query.filter_by(blocker_id=user_id, blocked_id=target_user_id).delete()
    db.session.commit()
    return jsonify({"blocked": False, "user_id": target_user_id})


@chat_bp.get("/direct/<int:room_id>/messages")
@jwt_required()
def direct_messages(room_id):
    user_id = int(get_jwt_identity())
    try:
        room = ensure_direct_room_access(room_id, user_id)
        page = pagination_args()
        if page is None:
            ordered_messages = sorted(room.messages, key=lambda message: (message.created_at, message.id))
            return jsonify({"room": room.to_dict(current_user_id=user_id), "items": [message.to_dict() for message in ordered_messages]})

        limit, before_id, after_id = page
        message_query = (
            DirectChatMessage.query
            .options(joinedload(DirectChatMessage.sender).joinedload(User.profile))
            .filter(DirectChatMessage.direct_chat_room_id == room.id)
        )
        ordered_messages, has_more = page_messages(
            message_query, DirectChatMessage, limit, before_id=before_id, after_id=after_id
        )
        response = {
            "items": [message.to_dict() for message in ordered_messages],
            "has_more": has_more,
            "latest_id": ordered_messages[-1].id if ordered_messages else after_id,
            "next_before_id": ordered_messages[0].id if has_more and ordered_messages else None,
        }
        if not after_id:
            response["room"] = room.to_dict(current_user_id=user_id)
        return jsonify(response)
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
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


@chat_bp.post("/direct/<int:room_id>/leave")
@jwt_required()
def leave_direct_room(room_id):
    user_id = int(get_jwt_identity())
    try:
        room = ensure_direct_room_access(room_id, user_id)
        if not room.is_active:
            room.mark_left(user_id)
            db.session.commit()
            return jsonify({"left": True, "room_id": room.id, "ended": True, "hidden": True})
        room.end(user_id)
        room.updated_at = room.ended_at
        db.session.add(DirectChatMessage(
            direct_chat_room_id=room.id,
            sender_id=user_id,
            content="상대방이 채팅방을 나갔습니다.",
            message_type="system",
            created_at=room.ended_at,
        ))
        db.session.commit()
        return jsonify({"left": True, "room_id": room.id, "ended": True})
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
        meeting = get_meeting_for_update(room.meeting_id)
        participant = get_participant_for_update(room.meeting_id, user_id)
        if participant.status != "approved":
            return jsonify({"message": "이미 나간 채팅방입니다."}), 400
        participant.status = "cancelled"
        recalculate_current_participants(meeting)
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


@chat_bp.get("/unread-count")
@jwt_required()
def unread_count():
    """Return only the total unread message count (single integer).

    This is a lightweight alternative to fetching full room lists just to
    display a badge.  It avoids loading room data, messages, user profiles,
    and Base64 images, drastically reducing Supabase egress.
    """
    user_id = int(get_jwt_identity())

    # --- meeting chat rooms ---
    meeting_room_ids = (
        db.session.query(ChatRoom.id)
        .join(Meeting, ChatRoom.meeting_id == Meeting.id)
        .outerjoin(Participant, Participant.meeting_id == Meeting.id)
        .filter(
            Meeting.status.notin_(["cancelled", "suspended"]),
            or_(
                Meeting.host_id == user_id,
                (Participant.user_id == user_id) & (Participant.status == "approved"),
            ),
        )
        .distinct()
        .all()
    )
    meeting_room_id_list = [r[0] for r in meeting_room_ids]

    meeting_unread = 0
    if meeting_room_id_list:
        row = (
            db.session.query(func.count(ChatMessage.id))
            .outerjoin(
                ChatMessageRead,
                (ChatMessageRead.chat_message_id == ChatMessage.id)
                & (ChatMessageRead.user_id == user_id),
            )
            .filter(ChatMessage.chat_room_id.in_(meeting_room_id_list))
            .filter(ChatMessage.user_id != user_id)
            .filter(ChatMessageRead.id.is_(None))
            .scalar()
        )
        meeting_unread = row or 0

    # --- direct chat rooms ---
    from app.models import DirectChatMessage

    direct_room_ids = (
        db.session.query(DirectChatRoom.id)
        .filter(
            or_(
                DirectChatRoom.user_a_id == user_id,
                DirectChatRoom.user_b_id == user_id,
            ),
            DirectChatRoom.is_active.is_(True),
        )
        .all()
    )
    direct_room_id_list = [r[0] for r in direct_room_ids]

    direct_unread = 0
    if direct_room_id_list:
        direct_unread = (
            db.session.query(func.count(DirectChatMessage.id))
            .filter(DirectChatMessage.direct_chat_room_id.in_(direct_room_id_list))
            .filter(DirectChatMessage.sender_id != user_id)
            .scalar()
        ) or 0

    return jsonify({"unread_count": meeting_unread + direct_unread})
