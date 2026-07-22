from datetime import datetime, time, timedelta

from app.utils.timezone import kst_now


def _last_regular_session_end(meeting):
    if not meeting or not getattr(meeting, "id", None):
        return None

    from app.models import MeetingSession

    sessions = (
        MeetingSession.query
        .filter_by(meeting_id=meeting.id)
        .filter(MeetingSession.status != "cancelled")
        .all()
    )
    ends = [session.end_at or session.start_at for session in sessions if session.end_at or session.start_at]
    return max(ends) if ends else None


def meeting_operation_end_at(meeting):
    if not meeting:
        return None

    if meeting.meeting_type == "one_time":
        return meeting.end_at or meeting.start_at

    if meeting.meeting_type == "regular":
        if not meeting.end_at:
            return None
        last_session_end = _last_regular_session_end(meeting)
        if not last_session_end:
            return meeting.end_at
        if meeting.end_at.date() >= last_session_end.date():
            return meeting.end_at
        return None

    return meeting.end_at or meeting.start_at


def is_meeting_operation_ended(meeting, now=None):
    operation_end_at = meeting_operation_end_at(meeting)
    if not operation_end_at:
        return False
    ended_from = datetime.combine(operation_end_at.date() + timedelta(days=1), time.min)
    return (now or kst_now()) >= ended_from


def validate_meeting_can_reopen_recruitment(meeting, now=None):
    if not meeting:
        raise ValueError("모임 정보를 확인할 수 없습니다.")
    if meeting.status == "cancelled":
        raise ValueError("취소된 모임은 모집을 다시 시작할 수 없습니다.")
    if meeting.status == "suspended":
        raise ValueError("운영 중지된 모임은 모집을 다시 시작할 수 없습니다.")
    if is_meeting_operation_ended(meeting, now=now):
        raise ValueError("종료된 모임은 모집을 다시 시작할 수 없습니다.")


def meeting_chat_is_read_only(meeting):
    if not meeting:
        return False
    if meeting.status in {"cancelled", "suspended"}:
        return True
    return is_meeting_operation_ended(meeting)
