import calendar
import math
from datetime import date, datetime, time, timedelta

from flask import current_app
from sqlalchemy import and_, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import ChatMessage, ChatRoom, Meeting, MeetingSession, Participant, Review, Sport, User, Attendance
from app.services.notification_service import create_notification, send_web_push
from app.utils.timezone import kst_now, parse_client_datetime


def parse_datetime(value):
    return parse_client_datetime(value)


WEEKDAY_ORDER = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
WEEKDAY_INDEX = {day: index for index, day in enumerate(WEEKDAY_ORDER)}


def _parse_schedule_date(value):
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        raise ValueError("정기모임은 올바른 시작일이 필요합니다.")


def _parse_schedule_time(value, field_name):
    try:
        return time.fromisoformat(str(value))
    except (TypeError, ValueError):
        raise ValueError(f"정기모임은 올바른 {field_name}이 필요합니다.")


def _normalize_repeat_days(value):
    if not value:
        raise ValueError("정기모임은 반복 요일을 하나 이상 선택해야 합니다.")
    if not isinstance(value, list):
        raise ValueError("정기모임은 반복 요일을 하나 이상 선택해야 합니다.")

    normalized = []
    for day in value:
        normalized_day = str(day or "").strip().upper()
        if normalized_day not in WEEKDAY_INDEX:
            raise ValueError("올바르지 않은 반복 요일이 포함되어 있습니다.")
        if normalized_day not in normalized:
            normalized.append(normalized_day)

    if not normalized:
        raise ValueError("정기모임은 반복 요일을 하나 이상 선택해야 합니다.")
    return sorted(normalized, key=lambda day: WEEKDAY_INDEX[day])


def _build_repeat_rule(repeat_days):
    return f"FREQ=WEEKLY;BYDAY={','.join(repeat_days)}"


def _start_of_day(value):
    return datetime.combine(value, time.min)


def _end_of_day(value):
    return datetime.combine(value, time(23, 59, 59))


def _add_months(value, months):
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _last_day_of_month(value):
    return date(value.year, value.month, calendar.monthrange(value.year, value.month)[1])


def _rolling_session_target_end(now=None):
    current_date = (now or kst_now()).date()
    target_month = _add_months(date(current_date.year, current_date.month, 1), 2)
    return _last_day_of_month(target_month)


def _effective_session_target_end(schedule_end_date=None, now=None):
    target_end = _rolling_session_target_end(now)
    return min(target_end, schedule_end_date) if schedule_end_date else target_end


def _repeat_days_from_rule(repeat_rule):
    if not repeat_rule:
        return []
    for part in str(repeat_rule).split(";"):
        if part.startswith("BYDAY="):
            return _normalize_repeat_days(part.replace("BYDAY=", "", 1).split(","))
    return []


def _session_logical_start(session):
    return session.original_start_at or session.start_at


def _session_logical_end(session):
    return session.original_end_at or session.end_at


def _build_regular_sessions(
    schedule_start_date,
    start_time,
    end_time,
    repeat_days,
    target_end_date,
    session_number_start=1,
    existing_schedule_slots=None,
    existing_actual_start_dates=None,
):
    sessions = []
    current_date = schedule_start_date
    selected_weekdays = {WEEKDAY_INDEX[day] for day in repeat_days}
    existing_schedule_slots = existing_schedule_slots or set()
    existing_actual_start_dates = existing_actual_start_dates or set()

    while current_date <= target_end_date:
        if current_date.weekday() in selected_weekdays:
            start_at = datetime.combine(current_date, start_time)
            if start_at not in existing_schedule_slots and start_at not in existing_actual_start_dates:
                sessions.append({
                    "session_number": session_number_start + len(sessions),
                    "start_at": start_at,
                    "end_at": datetime.combine(current_date, end_time),
                })
        current_date += timedelta(days=1)

    return sessions


def ensure_regular_meeting_sessions(meeting, now=None):
    if not meeting or meeting.meeting_type != "regular":
        return {"created_count": 0, "target_end": None}

    existing_sessions = (
        MeetingSession.query
        .filter_by(meeting_id=meeting.id)
        .order_by(MeetingSession.start_at.asc())
        .all()
    )
    if not existing_sessions:
        return {"created_count": 0, "target_end": None, "reason": "missing_time_template"}

    repeat_days = _repeat_days_from_rule(meeting.repeat_rule)
    if not repeat_days:
        return {"created_count": 0, "target_end": None, "reason": "missing_repeat_rule"}

    template = (
        next((session for session in existing_sessions if session.end_at and not session.original_start_at), None)
        or next((session for session in existing_sessions if session.end_at), existing_sessions[0])
    )
    template_start = _session_logical_start(template)
    template_end = _session_logical_end(template)
    if not template_start:
        return {"created_count": 0, "target_end": None, "reason": "missing_time_template"}

    operation_end_date = meeting.end_at.date() if meeting.end_at else None
    logical_starts = [_session_logical_start(session) for session in existing_sessions if _session_logical_start(session)]
    if not logical_starts:
        return {"created_count": 0, "target_end": None, "reason": "missing_time_template"}
    last_existing_date = max(logical_start.date() for logical_start in logical_starts)
    # 2026-07-14: 기존 legacy regular는 Meeting.end_at이 첫 회차 종료시간일 수 있어 회차보다 빠르면 cap으로 쓰지 않는다.
    if operation_end_date and operation_end_date < last_existing_date:
        operation_end_date = None

    target_end = _effective_session_target_end(operation_end_date, now)
    if target_end < last_existing_date:
        return {"created_count": 0, "target_end": target_end.isoformat()}

    range_start = last_existing_date + timedelta(days=1)
    existing_schedule_slots = {
        _session_logical_start(session)
        for session in existing_sessions
        if _session_logical_start(session)
    }
    existing_actual_start_dates = {session.start_at for session in existing_sessions if session.start_at}
    next_session_number = max((session.session_number or 0) for session in existing_sessions) + 1
    new_sessions = _build_regular_sessions(
        range_start,
        template_start.time(),
        template_end.time() if template_end else template_start.time(),
        repeat_days,
        target_end,
        session_number_start=next_session_number,
        existing_schedule_slots=existing_schedule_slots,
        existing_actual_start_dates=existing_actual_start_dates,
    )
    for session in new_sessions:
        db.session.add(MeetingSession(
            meeting_id=meeting.id,
            session_number=session["session_number"],
            start_at=session["start_at"],
            end_at=session["end_at"],
            status="scheduled",
        ))
    return {
        "created_count": len(new_sessions),
        "range_start": range_start.isoformat(),
        "target_end": target_end.isoformat(),
    }


def ensure_all_regular_meeting_sessions(now=None):
    regular_meetings = (
        Meeting.query
        .filter(Meeting.meeting_type == "regular")
        .filter(Meeting.status.in_(["open", "full"]))
        .order_by(Meeting.id.asc())
        .all()
    )
    results = []
    total_created = 0
    try:
        for meeting in regular_meetings:
            result = ensure_regular_meeting_sessions(meeting, now=now)
            created_count = result.get("created_count", 0)
            total_created += created_count
            results.append({
                "meeting_id": meeting.id,
                **result,
            })
        if total_created:
            db.session.commit()
        return {"created_count": total_created, "items": results}
    except Exception:
        db.session.rollback()
        raise


def close_expired_one_time_meetings(now=None):
    now = now or kst_now()
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


def delete_expired_suspended_meetings(now=None):
    from datetime import timedelta
    from app.models import Review, Notice, Vote, VoteOption, VoteResponse, Attendance
    now = now or kst_now()
    limit_time = now - timedelta(days=30)
    
    expired_meetings = (
        Meeting.query
        .filter(Meeting.status == "suspended", Meeting.suspended_at <= limit_time)
        .all()
    )
    
    for meeting in expired_meetings:
        Review.query.filter_by(meeting_id=meeting.id).delete()
        Notice.query.filter_by(meeting_id=meeting.id).delete()
        
        votes = Vote.query.filter_by(meeting_id=meeting.id).all()
        for vote in votes:
            VoteResponse.query.filter_by(vote_id=vote.id).delete()
            VoteOption.query.filter_by(vote_id=vote.id).delete()
            db.session.delete(vote)
            
        Attendance.query.filter_by(meeting_id=meeting.id).delete()
        db.session.delete(meeting)
        
    if expired_meetings:
        db.session.commit()


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


def _region_search_terms(value):
    region = str(value or "").strip()
    if not region:
        return []
    terms = [region]
    suffixes = [
        "특별자치시",
        "특별자치도",
        "특별시",
        "광역시",
        "자치도",
        "도",
    ]
    for suffix in suffixes:
        if region.endswith(suffix):
            terms.append(region[:-len(suffix)])
            break
    return [term for index, term in enumerate(terms) if term and term not in terms[:index]]


def _region_filter(column, value):
    terms = _region_search_terms(value)
    conditions = [column == value]
    for term in terms:
        like_term = f"%{term}%"
        conditions.append(Meeting.address.ilike(like_term))
        conditions.append(Meeting.location_name.ilike(like_term))
    return or_(*conditions)


def _display_name(user):
    if not user:
        return "참여자"
    return user.nickname or user.name or "참여자"


def _add_meeting_system_message(meeting, user_id, content):
    chat_room = meeting.chat_room or ChatRoom(meeting_id=meeting.id)
    if not meeting.chat_room:
        db.session.add(chat_room)
        db.session.flush()
    db.session.add(ChatMessage(
        chat_room_id=chat_room.id,
        user_id=user_id,
        content=content,
        message_type="system",
    ))


def list_meetings(params, current_user_id=None):
    delete_expired_suspended_meetings()
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
    elif params.get("category"):
        try:
            category_id = int(params["category"])
        except (TypeError, ValueError):
            category_id = None
        if category_id:
            query = query.join(Sport, Meeting.sport_id == Sport.id).filter(Sport.category_id == category_id)

######## 26.07.01 여기 충돌난 부분인데 확인해봐야됨 
#        sport_value = str(params["sport"]).strip()
#        if sport_value.isdigit():
#            query = query.filter(Meeting.sport_id == int(sport_value))
#        else:
#            query = query.join(Sport, Meeting.sport_id == Sport.id).filter(Sport.name == sport_value)

    if params.get("sido"):
        query = query.filter(_region_filter(Meeting.region_sido_code, params["sido"]))
    if params.get("sigungu"):
        query = query.filter(_region_filter(Meeting.region_sigungu_code, params["sigungu"]))
    if params.get("keyword"):
      keyword = f"%{params['keyword']}%"
      query = query.filter(Meeting.title.ilike(keyword) | Meeting.location_name.ilike(keyword) | Meeting.address.ilike(keyword))
    include_all_statuses = params.get("include_all") in {"1", "true", "yes"} or params.get("status") == "all"
    if params.get("status") and params.get("status") != "all":
        query = query.filter(Meeting.status == params["status"])
    elif include_all_statuses:
        query = query.filter(~Meeting.status.in_(["cancelled", "suspended"]))
    else:
        query = query.filter(Meeting.status.in_(["open", "full"]))
    if params.get("meeting_type") in {"regular", "one_time"}:
        query = query.filter(Meeting.meeting_type == params["meeting_type"])
    if params.get("mine") == "host" and current_user_id:
        query = query.filter(Meeting.host_id == current_user_id)
    if params.get("mine") == "joined" and current_user_id:
        query = query.join(Participant).filter(Participant.user_id == current_user_id, Participant.status == "approved")
    limit = max(1, min(int(params.get("limit", 20)), 50))
    is_recommend = params.get("recommend") in {"1", "true", "yes"}
    if is_recommend:
        query = query.filter(Meeting.status == "open")
        candidates = query.all()
        preferred_sports_list = []
        user_regions = []
        if current_user_id:
            user_obj = User.query.options(joinedload(User.profile)).get(current_user_id)
            if user_obj and user_obj.profile:
                if user_obj.profile.preferred_sports:
                    preferred_sports_list = [
                        s.strip() for s in user_obj.profile.preferred_sports.split(",") if s.strip()
                    ]
                if user_obj.profile.region:
                    user_regions = [
                        r.strip() for r in user_obj.profile.region.split() if len(r.strip()) > 1
                    ]


        def get_recommend_key(meeting):
            # 1순위: 내 관심 종목
            sport_match = 1
            if preferred_sports_list and meeting.sport:
                if meeting.sport.name in preferred_sports_list:
                    sport_match = 0
            
            # 2순위: 인원수가 많이 찬 모임 (100%에 가까울수록 먼저)
            max_p = meeting.max_participants or 1
            curr_p = meeting.current_participants or 0
            capacity_ratio = -(curr_p / max_p)
            
            # 3순위: 모임일이 더 빠른 순
            start_time = meeting.start_at.timestamp() if meeting.start_at else 9999999999
            
            # 4순위: 내가 설정한 활동지역 근처
            region_match = 1
            if user_regions and meeting.address:
                if any(r in meeting.address for r in user_regions):
                    region_match = 0
                    
            return (sport_match, capacity_ratio, start_time, region_match)

        candidates.sort(key=get_recommend_key)
        return candidates[:limit]

    latitude = _float_param(params, "lat") or _float_param(params, "latitude")
    longitude = _float_param(params, "lng") or _float_param(params, "longitude")
    if latitude is not None and longitude is not None:
        radius_km = _float_param(params, "radius_km") or _float_param(params, "radius")
        has_keyword_filter = bool(params.get("keyword"))
        candidates = query.order_by(Meeting.start_at.is_(None), Meeting.start_at.asc()).limit(80).all()
        for meeting in candidates:
            meeting._distance_km = _distance_km(latitude, longitude, meeting.latitude, meeting.longitude)
        if radius_km is not None:
            candidates = [
                meeting for meeting in candidates
                if (meeting._distance_km is not None and meeting._distance_km <= radius_km)
                or (has_keyword_filter and meeting._distance_km is None)
            ]
        candidates.sort(key=lambda meeting: meeting._distance_km if meeting._distance_km is not None else 999999)
        return candidates[:limit]
    return query.order_by(Meeting.start_at.is_(None), Meeting.start_at.asc()).limit(limit).all()


def list_meeting_sessions(meeting_id, include_cancelled=True):
    Meeting.query.get_or_404(meeting_id)
    query = MeetingSession.query.filter_by(meeting_id=meeting_id)
    if not include_cancelled:
        query = query.filter(MeetingSession.status != "cancelled")
    return query.order_by(MeetingSession.start_at.asc()).all()


def get_next_meeting_session(meeting_id, now=None):
    now = now or kst_now()
    return (
        MeetingSession.query
        .filter_by(meeting_id=meeting_id, status="scheduled")
        .filter(MeetingSession.start_at >= now)
        .order_by(MeetingSession.start_at.asc())
        .first()
    )


SESSION_CHANGE_REASON_MAX_LENGTH = 255
KOREAN_WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]


def _session_reason(value, field_name):
    if not isinstance(value, str):
        raise ValueError(f"{field_name}을 입력해 주세요.")
    reason = value.strip()
    if not reason:
        raise ValueError(f"{field_name}을 입력해 주세요.")
    if len(reason) > SESSION_CHANGE_REASON_MAX_LENGTH:
        raise ValueError(f"{field_name}은 {SESSION_CHANGE_REASON_MAX_LENGTH}자 이내로 입력해 주세요.")
    return reason


def _format_session_schedule(start_at, end_at=None):
    if not start_at:
        return "일정 미정"
    weekday = KOREAN_WEEKDAYS[start_at.weekday()]
    text = f"{start_at.month}월 {start_at.day}일 ({weekday}) {start_at:%H:%M}"
    if end_at:
        text = f"{text}~{end_at:%H:%M}"
    return text


def _session_notification_recipients(meeting):
    rows = (
        Participant.query
        .filter_by(meeting_id=meeting.id, status="approved")
        .filter(Participant.user_id != meeting.host_id)
        .all()
    )
    return sorted({row.user_id for row in rows})


def _send_session_pushes(user_ids, title, message, link_url):
    for user_id in user_ids:
        try:
            send_web_push(user_id, title, message, link_url)
        except Exception as error:
            current_app.logger.warning("Meeting session push notification failed: %s", error)


def _meeting_chat_link_url(meeting):
    if not meeting.chat_room:
        meeting.chat_room = ChatRoom(meeting_id=meeting.id)
        db.session.flush()
    return f"/chats/{meeting.chat_room.id}"


def _get_manageable_regular_session(meeting_id, session_id, current_user_id, action_text):
    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        raise LookupError("모임을 찾을 수 없습니다.")
    if meeting.host_id != current_user_id:
        raise PermissionError("방장만 일정을 관리할 수 있습니다.")
    if meeting.meeting_type != "regular":
        raise ValueError("정기모임 일정만 관리할 수 있습니다.")

    session = MeetingSession.query.filter_by(id=session_id, meeting_id=meeting_id).first()
    if not session:
        raise LookupError("일정을 찾을 수 없습니다.")
    if session.status != "scheduled":
        raise ValueError(f"{action_text}할 수 없는 일정입니다.")
    if session.start_at <= kst_now():
        raise ValueError(f"지난 일정은 {action_text}할 수 없습니다.")
    return meeting, session


def _validate_session_period(meeting, new_start, new_end):
    # 2026-07-15: 정기모임 개별 회차는 운영 기간 표시값과 별개로 미래 일정이면 앞뒤 날짜로 조정할 수 있게 한다.
    # Meeting.start_at/end_at은 운영 기간 또는 legacy 호환값일 수 있어 개별 회차 변경 범위 검증에는 사용하지 않는다.
    return


def _validate_session_time_conflict(meeting_id, session_id, new_start, new_end):
    duplicate = (
        MeetingSession.query
        .filter_by(meeting_id=meeting_id, start_at=new_start)
        .filter(MeetingSession.id != session_id)
        .first()
    )
    if duplicate:
        raise ValueError("같은 시작 시간의 일정이 이미 있습니다.")

    overlap = (
        MeetingSession.query
        .filter_by(meeting_id=meeting_id)
        .filter(MeetingSession.id != session_id)
        .filter(MeetingSession.status != "cancelled")
        .filter(MeetingSession.end_at.isnot(None))
        .filter(MeetingSession.start_at < new_end)
        .filter(MeetingSession.end_at > new_start)
        .first()
    )
    if overlap:
        raise ValueError("같은 모임 안에 시간이 겹치는 일정이 있습니다.")


def update_meeting_session(meeting_id, session_id, current_user_id, data):
    meeting, session = _get_manageable_regular_session(meeting_id, session_id, current_user_id, "변경")
    new_start = parse_datetime(data.get("start_at"))
    new_end = parse_datetime(data.get("end_at"))
    if not new_start:
        raise ValueError("변경할 시작 시간을 입력해 주세요.")
    if not new_end:
        raise ValueError("변경할 종료 시간을 입력해 주세요.")
    if new_end <= new_start:
        raise ValueError("종료 시간은 시작 시간 이후여야 합니다.")
    if new_start.date() != new_end.date():
        raise ValueError("일정 변경은 같은 날짜 안에서만 가능합니다.")
    if new_start <= kst_now():
        raise ValueError("현재 이후의 시간으로만 변경할 수 있습니다.")

    reason = _session_reason(data.get("reason"), "변경 사유")
    _validate_session_period(meeting, new_start, new_end)
    _validate_session_time_conflict(meeting.id, session.id, new_start, new_end)

    old_schedule = _format_session_schedule(session.start_at, session.end_at)
    new_schedule = _format_session_schedule(new_start, new_end)
    recipients = _session_notification_recipients(meeting)
    title = "모임 일정이 변경되었습니다."
    message = f"{meeting.title} 일정이 {old_schedule}에서 {new_schedule}(으)로 변경되었습니다. 사유: {reason}"
    link_url = _meeting_chat_link_url(meeting)

    try:
        if session.original_start_at is None:
            session.original_start_at = session.start_at
        if session.original_end_at is None:
            session.original_end_at = session.end_at
        session.start_at = new_start
        session.end_at = new_end
        session.reschedule_reason = reason
        for user_id in recipients:
            create_notification(user_id, "schedule_changed", title, message, link_url, send_push=False)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ValueError("같은 시작 시간의 일정이 이미 있습니다.")
    except Exception:
        db.session.rollback()
        raise

    _send_session_pushes(recipients, title, message, link_url)
    return session


def cancel_meeting_session(meeting_id, session_id, current_user_id, reason):
    meeting, session = _get_manageable_regular_session(meeting_id, session_id, current_user_id, "취소")
    cancellation_reason = _session_reason(reason, "취소 사유")
    cancelled_schedule = _format_session_schedule(session.start_at, session.end_at)
    next_session = (
        MeetingSession.query
        .filter_by(meeting_id=meeting.id, status="scheduled")
        .filter(MeetingSession.id != session.id)
        .filter(MeetingSession.start_at > session.start_at)
        .order_by(MeetingSession.start_at.asc())
        .first()
    )
    next_text = f" 다음 일정: {_format_session_schedule(next_session.start_at, next_session.end_at)}" if next_session else ""
    recipients = _session_notification_recipients(meeting)
    title = "모임 일정이 취소되었습니다."
    message = f"{meeting.title}의 {cancelled_schedule} 일정이 취소되었습니다. 사유: {cancellation_reason}{next_text}"
    link_url = _meeting_chat_link_url(meeting)

    try:
        session.status = "cancelled"
        session.cancellation_reason = cancellation_reason
        for user_id in recipients:
            create_notification(user_id, "schedule_cancelled", title, message, link_url, send_push=False)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    _send_session_pushes(recipients, title, message, link_url)
    return session


def update_meeting(meeting_id, host_id, data):
    meeting = Meeting.query.get_or_404(meeting_id)
    if meeting.host_id != host_id:
        raise PermissionError("방장만 수정할 수 있습니다.")

    if "max_participants" in data:
        from app.utils.settings import load_system_settings
        settings = load_system_settings()
        max_limit = settings.get("defaultMaxParticipants", 6)
        if int(data["max_participants"]) > max_limit:
            raise ValueError(f"개설 최대 정원은 {max_limit}명 이하로만 설정 가능합니다.")

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
    try:
        sport = Sport.query.get(data["sport_id"])
        if not sport:
            raise ValueError("존재하지 않는 종목입니다.")

        from app.utils.settings import load_system_settings
        settings = load_system_settings()
        max_limit = settings.get("defaultMaxParticipants", 6)
        max_participants = int(data.get("max_participants", 6))
        if max_participants > max_limit:
            raise ValueError(f"개설 최대 정원은 {max_limit}명 이하로만 설정 가능합니다.")

        meeting_type = data.get("meeting_type", "one_time")
        start_at = parse_datetime(data.get("start_at"))
        end_at = None
        repeat_rule = None
        regular_sessions = []

        if meeting_type == "one_time":
            if not start_at:
                raise ValueError("일회성 모임은 시작 시간이 필요합니다.")
            # 2026-07-14: 일회성 모임은 종료 입력 없이 같은 날 23:59:59까지 운영되는 것으로 저장한다.
            end_at = _end_of_day(start_at.date())

        elif meeting_type == "regular":
            if not data.get("schedule_start_date"):
                raise ValueError("정기모임은 시작일이 필요합니다.")
            if not data.get("start_time") or not data.get("end_time"):
                raise ValueError("정기모임은 시작 시간과 종료 시간이 필요합니다.")

            schedule_start_date = _parse_schedule_date(data.get("schedule_start_date"))
            schedule_end_date = _parse_schedule_date(data.get("schedule_end_date")) if data.get("schedule_end_date") else None
            if schedule_end_date and schedule_end_date < schedule_start_date:
                raise ValueError("모임 종료일은 시작일보다 빠를 수 없습니다.")
            schedule_start_time = _parse_schedule_time(data.get("start_time"), "시작 시간")
            schedule_end_time = _parse_schedule_time(data.get("end_time"), "종료 시간")
            if schedule_end_time <= schedule_start_time:
                raise ValueError("종료 시간은 시작 시간 이후여야 합니다.")

            repeat_days = _normalize_repeat_days(data.get("repeat_days"))
            repeat_rule = _build_repeat_rule(repeat_days)
            target_end_date = _effective_session_target_end(schedule_end_date)
            regular_sessions = _build_regular_sessions(
                schedule_start_date,
                schedule_start_time,
                schedule_end_time,
                repeat_days,
                target_end_date,
            )
            if not regular_sessions:
                raise ValueError("생성할 정기모임 회차가 없습니다.")
            # 2026-07-14: 정기모임의 Meeting 시간은 운영 기간, MeetingSession 시간은 실제 회차를 뜻한다.
            start_at = _start_of_day(schedule_start_date)
            end_at = _end_of_day(schedule_end_date) if schedule_end_date else None

        meeting = Meeting(
            host_id=host_id,
            sport_id=sport.id,
            title=data["title"],
            description=data["description"],
            meeting_type=meeting_type,
            purpose=data.get("purpose", "운동 메이트 모집"),
            region_sido_code=data.get("region_sido_code"),
            region_sigungu_code=data.get("region_sigungu_code"),
            location_name=data["location_name"],
            address=data["address"],
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            start_at=start_at,
            end_at=end_at,
            repeat_rule=repeat_rule,
            max_participants=data.get("max_participants", 6),
            approval_required=True,
            cover_image_url=data.get("cover_image_url")
        )
        db.session.add(meeting)
        db.session.flush()
        if meeting_type == "one_time":
            db.session.add(MeetingSession(
                meeting_id=meeting.id,
                session_number=1,
                start_at=meeting.start_at,
                end_at=None,
                status="scheduled",
            ))
        elif meeting_type == "regular":
            for session in regular_sessions:
                db.session.add(MeetingSession(
                    meeting_id=meeting.id,
                    session_number=session["session_number"],
                    start_at=session["start_at"],
                    end_at=session["end_at"],
                    status="scheduled",
                ))
        db.session.add(Participant(meeting_id=meeting.id, user_id=host_id, role="host", status="approved", approved_at=kst_now()))
        db.session.add(ChatRoom(meeting_id=meeting.id))
        db.session.commit()
        return meeting
    except Exception:
        db.session.rollback()
        raise


def join_meeting(meeting_id, user_id, join_message=""):
    close_expired_one_time_meetings()
    meeting = Meeting.query.get_or_404(meeting_id)
    applicant = User.query.options(joinedload(User.profile)).get(user_id)
    applicant_name = applicant.nickname if applicant and getattr(applicant, "nickname", None) else (applicant.name if applicant else "신청자")
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
    if meeting.status == "suspended":
        raise ValueError("폐쇄(비활성화) 처리된 모임입니다.")
    if meeting.host_id != host_id:
        raise PermissionError("방장만 처리할 수 있습니다.")
    participant = Participant.query.filter_by(meeting_id=meeting.id, user_id=applicant_user_id).first_or_404()
    if participant.status != "pending":
        raise ValueError("대기 중인 신청만 처리할 수 있습니다.")
    if status == "approved":
        if meeting.current_participants >= meeting.max_participants:
            raise ValueError("모집 정원이 마감되었습니다.")
        participant.status = "approved"
        participant.approved_at = kst_now()
        meeting.current_participants += 1
        if not meeting.chat_room:
            meeting.chat_room = ChatRoom(meeting_id=meeting.id)
            db.session.flush()
        if meeting.current_participants >= meeting.max_participants:
            meeting.status = "full"
        _add_meeting_system_message(meeting, participant.user_id, f"{_display_name(participant.user)}님이 입장하셨습니다.")
        title = "참여 신청 승인"
        message = f"{meeting.title} 참여 신청이 승인되었습니다."
        link_url = f"/chats/{meeting.chat_room.id}"
    else:
        participant.status = "rejected"
        participant.rejected_at = kst_now()
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
    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        raise ValueError("존재하지 않는 모임입니다.")
    if meeting.status == "suspended":
        raise PermissionError("폐쇄(비활성화) 처리된 모임입니다.")
    participant = Participant.query.filter_by(meeting_id=meeting_id, user_id=user_id, status="approved").first()
    if not participant:
        raise PermissionError("참여 확정된 사용자만 후기를 작성할 수 있습니다.")

    reviewee_id = data.get("reviewee_id")
    if not reviewee_id:
        raise ValueError("후기를 남길 대상을 선택해 주세요.")

    reviewee_id = int(reviewee_id)
    if reviewee_id == user_id:
        raise ValueError("자기 자신에게는 후기를 작성할 수 없습니다.")

    reviewee_part = Participant.query.filter_by(meeting_id=meeting_id, user_id=reviewee_id, status="approved").first()
    if not reviewee_part:
        raise ValueError("참여 확정된 사용자에게만 후기를 작성할 수 있습니다.")

    if meeting.status != "closed":
        raise ValueError("종료된 모임에 대해서만 후기를 작성할 수 있습니다.")

    # Check attendance check constraint
    if user_id != meeting.host_id:
        reviewer_att = Attendance.query.filter_by(meeting_id=meeting_id, user_id=user_id, status="present").first()
        if not reviewer_att:
            raise PermissionError("출석 체크를 완료한 사용자만 후기를 작성할 수 있습니다.")

    if reviewee_id != meeting.host_id:
        reviewee_att = Attendance.query.filter_by(meeting_id=meeting_id, user_id=reviewee_id, status="present").first()
        if not reviewee_att:
            raise ValueError("출석 체크를 완료한 대상에게만 후기를 작성할 수 있습니다.")

    existing = Review.query.filter_by(meeting_id=meeting_id, reviewer_id=user_id, reviewee_id=reviewee_id).first()
    if existing:
        raise ValueError("이미 이 참가자에게 후기를 작성했습니다.")

    review = Review(
        meeting_id=meeting_id,
        reviewer_id=user_id,
        reviewee_id=reviewee_id,
        rating=int(data["rating"]),
        content=data["content"]
    )
    db.session.add(review)
    db.session.commit()

    # Recalculate average rating for reviewee
    from app.models.users import UserProfile
    avg_rating = db.session.query(db.func.avg(Review.rating)).filter_by(reviewee_id=reviewee_id).scalar() or 0.0
    profile = UserProfile.query.filter_by(user_id=reviewee_id).first()
    if profile:
        profile.rating_average = round(float(avg_rating), 1)
        db.session.commit()

    return review


def list_user_reviews(user_id):
    return Review.query.filter_by(reviewer_id=user_id).order_by(Review.created_at.desc()).all()


def list_written_reviews(user_id):
    return (
        Review.query
        .options(joinedload(Review.reviewee).joinedload(User.profile), joinedload(Review.meeting))
        .filter_by(reviewer_id=user_id)
        .order_by(Review.created_at.desc())
        .all()
    )


def list_received_reviews(user_id):
    return (
        Review.query
        .options(joinedload(Review.reviewer).joinedload(User.profile), joinedload(Review.meeting))
        .filter_by(reviewee_id=user_id)
        .order_by(Review.created_at.desc())
        .all()
    )


def list_pending_reviews(user_id):
    my_closed_meetings = (
        Meeting.query
        .join(Participant, Meeting.id == Participant.meeting_id)
        .filter(
            Meeting.status == "closed",
            Participant.user_id == user_id,
            Participant.status == "approved"
        )
        .all()
    )

    pending_items = []

    for meeting in my_closed_meetings:
        # Check if reviewer checked attendance (hosts are always considered present)
        if meeting.host_id != user_id:
            my_attendance = Attendance.query.filter_by(meeting_id=meeting.id, user_id=user_id, status="present").first()
            if not my_attendance:
                continue

        peers = (
            Participant.query
            .options(joinedload(Participant.user).joinedload(User.profile))
            .filter(
                Participant.meeting_id == meeting.id,
                Participant.status == "approved",
                Participant.user_id != user_id
            )
            .all()
        )

        for p in peers:
            # Check if peer checked attendance (hosts are always considered present)
            if meeting.host_id != p.user_id:
                peer_attendance = Attendance.query.filter_by(meeting_id=meeting.id, user_id=p.user_id, status="present").first()
                if not peer_attendance:
                    continue

            exists = Review.query.filter_by(
                meeting_id=meeting.id,
                reviewer_id=user_id,
                reviewee_id=p.user_id
            ).first()

            if not exists:
                pending_items.append({
                    "meeting": {
                        "id": meeting.id,
                        "title": meeting.title,
                        "start_time": meeting.start_at.isoformat() if meeting.start_at else None
                    },
                    "peer": p.user.to_dict()
                })

    return pending_items


def update_review(review_id, user_id, data):
    review = Review.query.get(review_id)
    if not review:
        raise ValueError("존재하지 않는 후기입니다.")
    if review.reviewer_id != user_id:
        raise PermissionError("본인이 작성한 후기만 수정할 수 있습니다.")
    
    if "rating" in data:
        review.rating = int(data["rating"])
    if "content" in data:
        review.content = data["content"]
        
    db.session.commit()
    
    # Recalculate average rating for reviewee
    from app.models.users import UserProfile
    avg_rating = db.session.query(db.func.avg(Review.rating)).filter_by(reviewee_id=review.reviewee_id).scalar() or 0.0
    profile = UserProfile.query.filter_by(user_id=review.reviewee_id).first()
    if profile:
        profile.rating_average = round(float(avg_rating), 1)
        db.session.commit()
        
    return review


def delete_review(review_id, user_id):
    review = Review.query.get(review_id)
    if not review:
        raise ValueError("존재하지 않는 후기입니다.")
    if review.reviewer_id != user_id:
        raise PermissionError("본인이 작성한 후기만 삭제할 수 있습니다.")
        
    reviewee_id = review.reviewee_id
    db.session.delete(review)
    db.session.commit()
    
    # Recalculate average rating for reviewee
    from app.models.users import UserProfile
    avg_rating = db.session.query(db.func.avg(Review.rating)).filter_by(reviewee_id=reviewee_id).scalar() or 0.0
    profile = UserProfile.query.filter_by(user_id=reviewee_id).first()
    if profile:
        profile.rating_average = round(float(avg_rating), 1)
        db.session.commit()
