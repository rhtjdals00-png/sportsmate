from dataclasses import dataclass
from datetime import datetime, timedelta


QR_EARLY_MINUTES = 30
QR_FALLBACK_DURATION_MINUTES = 30
UNAVAILABLE_MEETING_STATUSES = {"cancelled", "suspended"}


@dataclass(frozen=True)
class AttendancePolicyResult:
    allowed: bool
    code: str | None
    message: str
    opens_at: datetime | None = None
    closes_at: datetime | None = None


def get_qr_attendance_window(session):
    if not session or not getattr(session, "start_at", None):
        return None, None
    opens_at = session.start_at - timedelta(minutes=QR_EARLY_MINUTES)
    closes_at = getattr(session, "end_at", None) or (
        session.start_at + timedelta(minutes=QR_FALLBACK_DURATION_MINUTES)
    )
    return opens_at, closes_at


def evaluate_qr_attendance(session, now, meeting_status=None):
    opens_at, closes_at = get_qr_attendance_window(session)
    if not session or not opens_at or not closes_at:
        return AttendancePolicyResult(False, "INVALID_SESSION", "출석 회차 정보를 확인할 수 없습니다.")
    if meeting_status in UNAVAILABLE_MEETING_STATUSES:
        return AttendancePolicyResult(
            False,
            "MEETING_UNAVAILABLE",
            "현재 모임에서는 출석 체크를 진행할 수 없습니다.",
            opens_at,
            closes_at,
        )
    if getattr(session, "status", None) == "cancelled":
        return AttendancePolicyResult(
            False,
            "SESSION_CANCELLED",
            "취소된 일정은 출석 체크할 수 없습니다.",
            opens_at,
            closes_at,
        )
    if getattr(session, "status", None) != "scheduled":
        return AttendancePolicyResult(
            False,
            "INVALID_SESSION",
            "현재 출석 체크할 수 없는 일정입니다.",
            opens_at,
            closes_at,
        )
    if now < opens_at:
        return AttendancePolicyResult(
            False,
            "TOO_EARLY",
            "출석 체크는 일정 시작 30분 전부터 가능합니다.",
            opens_at,
            closes_at,
        )
    if now >= closes_at:
        return AttendancePolicyResult(
            False,
            "WINDOW_CLOSED",
            "출석 가능 시간이 종료되었습니다.",
            opens_at,
            closes_at,
        )
    return AttendancePolicyResult(True, None, "", opens_at, closes_at)


def evaluate_host_manual_attendance(session, now):
    if not session or not getattr(session, "start_at", None):
        return AttendancePolicyResult(False, "INVALID_SESSION", "출석 회차 정보를 확인할 수 없습니다.")
    if getattr(session, "status", None) == "cancelled":
        return AttendancePolicyResult(False, "SESSION_CANCELLED", "취소된 일정은 출석을 변경할 수 없습니다.")
    if now < session.start_at:
        return AttendancePolicyResult(False, "TOO_EARLY", "수동 출석 처리는 일정 시작 이후 가능합니다.")
    return AttendancePolicyResult(True, None, "")
