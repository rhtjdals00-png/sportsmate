from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))


def kst_now():
    return datetime.now(KST).replace(tzinfo=None)


def to_kst_iso(value):
    return value.isoformat() if value else ""


def parse_client_datetime(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo:
        return parsed.astimezone(KST).replace(tzinfo=None)
    return parsed
