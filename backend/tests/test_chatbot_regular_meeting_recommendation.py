import unittest
from datetime import datetime

from sqlalchemy import create_engine, select, text

from app.models import Meeting
from app.routes.chatbot_routes import chatbot_recommendation_active_filter


class ChatbotRegularMeetingRecommendationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        with self.engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE meetings (
                    id INTEGER PRIMARY KEY,
                    meeting_type VARCHAR(30) NOT NULL,
                    start_at DATETIME
                )
            """))
            connection.execute(text("""
                CREATE TABLE meeting_sessions (
                    id INTEGER PRIMARY KEY,
                    meeting_id INTEGER NOT NULL,
                    start_at DATETIME NOT NULL,
                    status VARCHAR(20) NOT NULL
                )
            """))

    def tearDown(self):
        self.engine.dispose()

    def recommended_ids(self, meetings, sessions=()):
        with self.engine.begin() as connection:
            connection.execute(
                text("INSERT INTO meetings (id, meeting_type, start_at) VALUES (:id, :meeting_type, :start_at)"),
                meetings,
            )
            if sessions:
                connection.execute(text("""
                    INSERT INTO meeting_sessions (id, meeting_id, start_at, status)
                    VALUES (:id, :meeting_id, :start_at, :status)
                """), sessions)
            statement = (
                select(Meeting.id)
                .where(chatbot_recommendation_active_filter(datetime(2026, 7, 24, 12, 0)))
                .order_by(Meeting.id)
            )
            return list(connection.execute(statement).scalars())

    def test_regular_meeting_uses_next_scheduled_session(self):
        recommended = self.recommended_ids(
            [
                {"id": 1, "meeting_type": "regular", "start_at": "2026-07-17 15:45:00"},
                {"id": 2, "meeting_type": "regular", "start_at": "2026-07-17 15:45:00"},
            ],
            [
                {"id": 1, "meeting_id": 1, "start_at": "2026-07-24 15:45:00", "status": "scheduled"},
                {"id": 2, "meeting_id": 2, "start_at": "2026-07-24 15:45:00", "status": "cancelled"},
            ],
        )

        self.assertEqual(recommended, [1])

    def test_one_time_meeting_still_uses_meeting_start_time(self):
        recommended = self.recommended_ids([
            {"id": 1, "meeting_type": "one_time", "start_at": "2026-07-24 15:45:00"},
            {"id": 2, "meeting_type": "one_time", "start_at": "2026-07-23 15:45:00"},
        ])

        self.assertEqual(recommended, [1])


if __name__ == "__main__":
    unittest.main()
