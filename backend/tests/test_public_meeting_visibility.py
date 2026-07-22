import unittest
from datetime import datetime

from sqlalchemy import create_engine, select, text

from app.models import Meeting
from app.services.meeting_service import public_board_operation_active_filter


class PublicMeetingVisibilityTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        with self.engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE meetings (
                    id INTEGER PRIMARY KEY,
                    meeting_type VARCHAR(30) NOT NULL,
                    end_at DATETIME
                )
            """))
            connection.execute(text("""
                CREATE TABLE meeting_sessions (
                    id INTEGER PRIMARY KEY,
                    meeting_id INTEGER NOT NULL,
                    start_at DATETIME NOT NULL,
                    end_at DATETIME,
                    status VARCHAR(20) NOT NULL
                )
            """))

    def tearDown(self):
        self.engine.dispose()

    def visible_ids(self, meetings, sessions=()):
        with self.engine.begin() as connection:
            connection.execute(
                text("INSERT INTO meetings (id, meeting_type, end_at) VALUES (:id, :meeting_type, :end_at)"),
                meetings,
            )
            if sessions:
                connection.execute(text("""
                    INSERT INTO meeting_sessions (id, meeting_id, start_at, end_at, status)
                    VALUES (:id, :meeting_id, :start_at, :end_at, :status)
                """), sessions)
            statement = (
                select(Meeting.id)
                .where(public_board_operation_active_filter(datetime(2026, 7, 22, 12, 0)))
                .order_by(Meeting.id)
            )
            return list(connection.execute(statement).scalars())

    def test_excludes_legacy_regular_meeting_with_past_end_and_no_sessions(self):
        visible = self.visible_ids([
            {"id": 1, "meeting_type": "regular", "end_at": "2026-07-14 21:00:00"},
            {"id": 2, "meeting_type": "regular", "end_at": "2026-07-29 21:00:00"},
            {"id": 3, "meeting_type": "regular", "end_at": None},
        ])

        self.assertEqual(visible, [2, 3])

    def test_uses_last_non_cancelled_session_for_finite_regular_meeting(self):
        visible = self.visible_ids(
            [
                {"id": 1, "meeting_type": "regular", "end_at": "2026-07-31 23:59:59"},
                {"id": 2, "meeting_type": "regular", "end_at": "2026-07-31 23:59:59"},
            ],
            [
                {"id": 1, "meeting_id": 1, "start_at": "2026-07-21 20:00:00", "end_at": "2026-07-21 21:00:00", "status": "scheduled"},
                {"id": 2, "meeting_id": 2, "start_at": "2026-07-28 20:00:00", "end_at": "2026-07-28 21:00:00", "status": "scheduled"},
            ],
        )

        self.assertEqual(visible, [2])

    def test_keeps_non_regular_meetings_in_this_filter(self):
        visible = self.visible_ids([
            {"id": 1, "meeting_type": "one_time", "end_at": "2026-07-14 21:00:00"},
        ])

        self.assertEqual(visible, [1])


if __name__ == "__main__":
    unittest.main()
