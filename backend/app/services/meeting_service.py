import math
from datetime import datetime

from flask import current_app
from sqlalchemy import and_, or_
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import ChatRoom, Meeting, Participant, Review, Sport, User
from app.services.notification_service import create_notification, send_web_push


def parse_datetime(value):
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)


def close_expired_one_time_meetings(now=None):
    now = now or datetime.now()
    expired_updated = (
        Meeting.query
        .filter(
            Meeting.status.in_(["open", "full"]),
            Meeting.meeting_type == "one_time",
            or_(
                and_(Meeting.end_at.isnot(None), Meeting.end_at < now),
                and_(Meeting.end_at.is_(None), Meeting.start_at.isnot(None), Meeting.start_at < now),
            )
        )
        .update({"status": "closed"}, synchronize_session=False)
    )
    full_updated = (
        Meeting.query
        .filter(
            Meeting.status == "open",
            Meeting.current_participants >= Meeting.max_participants,
        )
        .update({"status": "full"}, synchronize_session=False)
    )
    updated = expired_updated + full_updated
    if updated:
        db.session.commit()
    return updated


def _float_param(params, key):
    try:
        return float(params.get(key, ""))
    except (TypeError, ValueError):
        return None


def _distance_km(lat1, lng1, lat2, lng2):
    if None in (lat1, lng1, lat2, lng2):
        return None
    radius = 6371
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    return round(radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 1)


def list_meetings(params, current_user_id=None):
    close_expired_one_time_meetings()
    load_options = [
        joinedload(Meeting.host),
        joinedload(Meeting.sport).joinedload(Sport.category),
        joinedload(Meeting.chat_room),
    ]
    if current_user_id:
        load_options.append(joinedload(Meeting.participants))
    query = Meeting.query.options(*load_options)
    if params.get("sport"):
        try:
            sport_id = int(params["sport"])
        except (TypeError, ValueError):
            sport_id = None
        if sport_id:
            query = query.filter(Meeting.sport_id == sport_id)

######## 26.07.01 여기 충돌난 부분인데 확인해봐야됨 
#        sport_value = str(params["sport"]).strip()
#        if sport_value.isdigit():
#            query = query.filter(Meeting.sport_id == int(sport_value))
#        else:
#            query = query.join(Sport, Meeting.sport_id == Sport.id).filter(Sport.name == sport_value)

    if params.get("sido"):
        query = query.filter(Meeting.region_sido_code == params["sido"])
    if params.get("sigungu"):
        query = query.filter(Meeting.region_sigungu_code == params["sigungu"])
    if params.get("keyword"):
      keyword = f"%{params['keyword']}%"
      query = query.filter(Meeting.title.ilike(keyword) | Meeting.location_name.ilike(keyword) | Meeting.address.ilike(keyword))
    if params.get("status"):
        query = query.filter(Meeting.status == params["status"])
    else:
        query = query.filter(Meeting.status.in_(["open", "full"]))
    if params.get("mine") == "host" and current_user_id:
        query = query.filter(Meeting.host_id == current_user_id)
    if params.get("mine") == "joined" and current_user_id:
        query = query.join(Participant).filter(Participant.user_id == current_user_id, Participant.status == "approved")
    limit = max(1, min(int(params.get("limit", 20)), 50))
    latitude = _float_param(params, "lat") or _float_param(params, "latitude")
    longitude = _float_param(params, "lng") or _float_param(params, "longitude")
    if latitude is not None and longitude is not None:
        candidates = query.order_by(Meeting.start_at.is_(None), Meeting.start_at.asc()).limit(50).all()
        for meeting in candidates:
            meeting._distance_km = _distance_km(latitude, longitude, meeting.latitude, meeting.longitude)
        candidates.sort(key=lambda meeting: meeting._distance_km if meeting._distance_km is not None else 999999)
        return candidates[:limit]
    return query.order_by(Meeting.start_at.is_(None), Meeting.start_at.asc()).limit(limit).all()


def update_meeting(meeting_id, host_id, data):
    meeting = Meeting.query.get_or_404(meeting_id)
    if meeting.host_id != host_id:
        raise PermissionError("방장만 수정할 수 있습니다.")

    updatable_fields = [
        "sport_id",
        "title",
        "description",
        "meeting_type",
        "purpose",
        "region_sido_code",
        "region_sigungu_code",
        "location_name",
        "address",
        "latitude",
        "longitude",
        "max_participants",
        "cover_image_url",
        "status"
    ]
    for field in updatable_fields:
        if field in data:
            setattr(meeting, field, data[field])
    if "start_at" in data:
        meeting.start_at = parse_datetime(data["start_at"])
    if "end_at" in data:
        meeting.end_at = parse_datetime(data.get("end_at"))
    meeting.sync_status()
    db.session.commit()
    return meeting


def create_meeting(data, host_id):
    sport = Sport.query.get(data["sport_id"])
    if not sport:
        raise ValueError("존재하지 않는 종목입니다.")

    meeting = Meeting(
        host_id=host_id,
        sport_id=sport.id,
        title=data["title"],
        description=data["description"],
        meeting_type=data.get("meeting_type", "one_time"),
        purpose=data.get("purpose", "운동 메이트 모집"),
        region_sido_code=data.get("region_sido_code"),
        region_sigungu_code=data.get("region_sigungu_code"),
        location_name=data["location_name"],
        address=data["address"],
        latitude=data.get("latitude"),
        longitude=data.get("longitude"),
        start_at=parse_datetime(data.get("start_at")),
        end_at=parse_datetime(data.get("end_at")),
        max_participants=data.get("max_participants", 6),
        approval_required=True,
        cover_image_url=data.get("cover_image_url")
    )
    db.session.add(meeting)
    db.session.flush()
    db.session.add(Participant(meeting_id=meeting.id, user_id=host_id, role="host", status="approved", approved_at=datetime.utcnow()))
    db.session.add(ChatRoom(meeting_id=meeting.id))
    db.session.commit()
    return meeting


def join_meeting(meeting_id, user_id, join_message=""):
    close_expired_one_time_meetings()
    meeting = Meeting.query.get_or_404(meeting_id)
    applicant = User.query.options(joinedload(User.profile)).get(user_id)
    applicant_name = applicant.nickname if applicant and applicant.nickname else (applicant.name if applicant else "신청자")
    if meeting.status != "open":
        raise ValueError("모집 중인 모임만 신청할 수 있습니다.")
    if meeting.current_participants >= meeting.max_participants:
        raise ValueError("모집 정원이 마감되었습니다.")
    if Participant.query.filter_by(meeting_id=meeting.id, user_id=user_id).first():
        raise ValueError("이미 신청한 모임입니다.")

    participant = Participant(meeting_id=meeting.id, user_id=user_id, status="pending", join_message=join_message)
    db.session.add(participant)
    create_notification(meeting.host_id, "join_request", "새 참여 신청", f"{applicant_name}님이 {meeting.title}에 참여 신청을 보냈습니다.", f"/host/meetings/{meeting.id}/applicants", send_push=False)
    db.session.commit()
    try:
        send_web_push(meeting.host_id, "새 참여 신청", f"{applicant_name}님이 {meeting.title}에 참여 신청을 보냈습니다.", f"/host/meetings/{meeting.id}/applicants")
    except Exception as error:
        current_app.logger.warning("Join request push notification failed: %s", error)
    return participant


def update_application(meeting_id, applicant_user_id, host_id, status):
    meeting = Meeting.query.get_or_404(meeting_id)
    if meeting.host_id != host_id:
        raise PermissionError("방장만 처리할 수 있습니다.")
    participant = Participant.query.filter_by(meeting_id=meeting.id, user_id=applicant_user_id).first_or_404()
    if participant.status != "pending":
        raise ValueError("대기 중인 신청만 처리할 수 있습니다.")
    if status == "approved":
        if meeting.current_participants >= meeting.max_participants:
            raise ValueError("모집 정원이 마감되었습니다.")
        participant.status = "approved"
        participant.approved_at = datetime.utcnow()
        meeting.current_participants += 1
        if not meeting.chat_room:
            meeting.chat_room = ChatRoom(meeting_id=meeting.id)
            db.session.flush()
        if meeting.current_participants >= meeting.max_participants:
            meeting.status = "full"
        title = "참여 신청 승인"
        message = f"{meeting.title} 참여 신청이 승인되었습니다."
        link_url = f"/chats/{meeting.chat_room.id}"
    else:
        participant.status = "rejected"
        participant.rejected_at = datetime.utcnow()
        title = "참여 신청 거절"
        message = f"{meeting.title} 참여 신청이 거절되었습니다."
        link_url = f"/meetings/{meeting.id}"
    create_notification(participant.user_id, status, title, message, link_url, send_push=False)
    db.session.commit()
    try:
        send_web_push(participant.user_id, title, message, link_url)
    except Exception as error:
        current_app.logger.warning("Application decision push notification failed: %s", error)
    return participant


def create_review(meeting_id, user_id, data):
    participant = Participant.query.filter_by(meeting_id=meeting_id, user_id=user_id, status="approved").first()
    if not participant:
        raise PermissionError("참여 확정된 사용자만 후기를 작성할 수 있습니다.")
    review = Review(meeting_id=meeting_id, reviewer_id=user_id, rating=data["rating"], content=data["content"])
    db.session.add(review)
    db.session.commit()
    return review


def list_user_reviews(user_id):
    return Review.query.filter_by(reviewer_id=user_id).order_by(Review.created_at.desc()).all()
