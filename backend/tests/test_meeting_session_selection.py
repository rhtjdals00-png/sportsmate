import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace

from app.services.meeting_service import select_current_or_next_session


class MeetingSessionSelectionTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 7, 24, 15, 45)

    def session(self, session_id, start_at, end_at, status="scheduled"):
        return SimpleNamespace(
            id=session_id,
            start_at=start_at,
            end_at=end_at,
            status=status,
        )

    def test_ongoing_session_is_preferred_over_future_session(self):
        ongoing = self.session(
            1,
            self.now - timedelta(minutes=15),
            self.now + timedelta(hours=1),
        )
        future = self.session(
            2,
            self.now + timedelta(days=14),
            self.now + timedelta(days=14, hours=1),
        )

        selected = select_current_or_next_session([ongoing, future], self.now)

        self.assertIs(selected, ongoing)

    def test_ended_and_cancelled_sessions_are_skipped(self):
        ended = self.session(
            1,
            self.now - timedelta(hours=2),
            self.now - timedelta(hours=1),
        )
        cancelled = self.session(
            2,
            self.now + timedelta(days=7),
            self.now + timedelta(days=7, hours=1),
            status="cancelled",
        )
        future = self.session(
            3,
            self.now + timedelta(days=14),
            self.now + timedelta(days=14, hours=1),
        )

        selected = select_current_or_next_session([ended, cancelled, future], self.now)

        self.assertIs(selected, future)


if __name__ == "__main__":
    unittest.main()
