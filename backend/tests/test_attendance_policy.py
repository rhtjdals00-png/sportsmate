import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace

from app.utils.attendance_policy import (
    evaluate_host_manual_attendance,
    evaluate_qr_attendance,
    get_qr_attendance_window,
)


class AttendancePolicyTests(unittest.TestCase):
    def setUp(self):
        self.start_at = datetime(2026, 7, 23, 19, 0)
        self.session = SimpleNamespace(
            start_at=self.start_at,
            end_at=self.start_at + timedelta(hours=2),
            status="scheduled",
        )

    def test_qr_blocks_one_minute_before_window(self):
        result = evaluate_qr_attendance(self.session, self.start_at - timedelta(minutes=31), "open")
        self.assertFalse(result.allowed)
        self.assertEqual(result.code, "TOO_EARLY")

    def test_qr_allows_window_open_boundary(self):
        result = evaluate_qr_attendance(self.session, self.start_at - timedelta(minutes=30), "open")
        self.assertTrue(result.allowed)

    def test_qr_allows_session_start(self):
        result = evaluate_qr_attendance(self.session, self.start_at, "open")
        self.assertTrue(result.allowed)

    def test_qr_allows_just_before_session_end(self):
        result = evaluate_qr_attendance(
            self.session,
            self.session.end_at - timedelta(microseconds=1),
            "open",
        )
        self.assertTrue(result.allowed)

    def test_qr_blocks_at_session_end(self):
        result = evaluate_qr_attendance(self.session, self.session.end_at, "open")
        self.assertFalse(result.allowed)
        self.assertEqual(result.code, "WINDOW_CLOSED")

    def test_qr_uses_thirty_minute_fallback_when_end_is_missing(self):
        self.session.end_at = None
        opens_at, closes_at = get_qr_attendance_window(self.session)
        self.assertEqual(opens_at, self.start_at - timedelta(minutes=30))
        self.assertEqual(closes_at, self.start_at + timedelta(minutes=30))
        self.assertTrue(
            evaluate_qr_attendance(
                self.session,
                self.start_at + timedelta(minutes=29, seconds=59),
                "open",
            ).allowed
        )
        self.assertEqual(
            evaluate_qr_attendance(
                self.session,
                self.start_at + timedelta(minutes=30),
                "open",
            ).code,
            "WINDOW_CLOSED",
        )

    def test_qr_blocks_cancelled_session(self):
        self.session.status = "cancelled"
        result = evaluate_qr_attendance(self.session, self.start_at, "open")
        self.assertEqual(result.code, "SESSION_CANCELLED")

    def test_qr_blocks_unavailable_meeting(self):
        result = evaluate_qr_attendance(self.session, self.start_at, "suspended")
        self.assertEqual(result.code, "MEETING_UNAVAILABLE")

    def test_manual_blocks_future_session(self):
        result = evaluate_host_manual_attendance(self.session, self.start_at - timedelta(seconds=1))
        self.assertEqual(result.code, "TOO_EARLY")

    def test_manual_allows_session_start_and_past(self):
        self.assertTrue(evaluate_host_manual_attendance(self.session, self.start_at).allowed)
        self.assertTrue(
            evaluate_host_manual_attendance(
                self.session,
                self.start_at + timedelta(days=3),
            ).allowed
        )

    def test_manual_blocks_cancelled_session(self):
        self.session.status = "cancelled"
        result = evaluate_host_manual_attendance(self.session, self.start_at + timedelta(days=1))
        self.assertEqual(result.code, "SESSION_CANCELLED")


if __name__ == "__main__":
    unittest.main()
