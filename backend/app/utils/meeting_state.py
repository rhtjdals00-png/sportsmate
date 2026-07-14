from app.utils.timezone import kst_now


def meeting_chat_is_read_only(meeting):
    if not meeting:
        return False
    if meeting.status in {"closed", "cancelled", "suspended"}:
        return True
    end_at = meeting.end_at or meeting.start_at
    return bool(end_at and end_at <= kst_now())
