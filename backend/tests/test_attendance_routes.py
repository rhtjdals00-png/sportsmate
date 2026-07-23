import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from flask import Flask

from app.extensions import db
from app.routes import meeting_routes
from app.services import meeting_service


class AttendanceRouteTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            SQLALCHEMY_DATABASE_URI="sqlite://",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
        )
        db.init_app(self.app)
        self.now = datetime(2026, 7, 23, 19, 0)
        self.meeting = SimpleNamespace(id=4, host_id=1, status="open", title="테스트 모임")
        self.session = SimpleNamespace(
            id=10,
            meeting_id=4,
            start_at=self.now,
            end_at=self.now + timedelta(hours=1),
            status="scheduled",
            to_dict=lambda: {"id": 10},
        )
        self.participant = SimpleNamespace(id=8, user_id=2, status="approved")

    def test_approved_participant_cannot_call_manual_endpoint(self):
        meeting_query = MagicMock()
        meeting_query.get_or_404.return_value = self.meeting

        with self.app.test_request_context(json={"user_id": 2, "session_id": 10}), \
             patch.object(meeting_routes.Meeting, "query", meeting_query), \
             patch.object(meeting_routes, "get_jwt_identity", return_value="2"):
            response, status = meeting_routes.check_attendance.__wrapped__(4)

        self.assertEqual(status, 403)
        self.assertEqual(response.get_json()["code"], "HOST_ONLY")

    def test_attendance_session_lock_refreshes_latest_row(self):
        session_query = MagicMock()
        session_query.filter_by.return_value.populate_existing.return_value.with_for_update.return_value.first.return_value = self.session

        with self.app.app_context(), patch.object(meeting_routes.MeetingSession, "query", session_query):
            result = meeting_routes.get_attendance_session_for_update(4, 10)

        self.assertIs(result, self.session)
        session_query.filter_by.assert_called_once_with(id=10, meeting_id=4)
        session_query.filter_by.return_value.populate_existing.assert_called_once_with()
        session_query.filter_by.return_value.populate_existing.return_value.with_for_update.assert_called_once_with()

    def test_future_attendance_schedule_conflict_returns_409(self):
        error = meeting_service.FutureSessionAttendanceConflictError()

        with self.app.test_request_context(json={
            "start_at": "2026-07-24T19:00:00",
            "end_at": "2026-07-24T20:00:00",
            "reason": "일정 변경",
        }), \
             patch.object(meeting_routes, "get_jwt_identity", return_value="1"), \
             patch.object(meeting_routes, "update_meeting_session", side_effect=error):
            response, status = meeting_routes.patch_session.__wrapped__(4, 10)

        self.assertEqual(status, 409)
        self.assertEqual(response.get_json()["code"], "FUTURE_SESSION_ATTENDANCE_EXISTS")

    def test_host_cannot_mark_future_session(self):
        participant_query = MagicMock()
        participant_query.filter_by.return_value.first.return_value = self.participant

        with self.app.test_request_context(json={"user_id": 2, "session_id": 10}), \
             patch.object(meeting_routes.Meeting, "query", MagicMock(get_or_404=MagicMock(return_value=self.meeting))), \
             patch.object(meeting_routes.Participant, "query", participant_query), \
             patch.object(meeting_routes, "get_jwt_identity", return_value="1"), \
             patch.object(
                 meeting_routes,
                 "resolve_attendance_session",
                 return_value=(self.session, [], []),
             ), \
             patch.object(meeting_routes, "kst_now", return_value=self.now - timedelta(seconds=1)):
            response, status = meeting_routes.check_attendance.__wrapped__(4)

        self.assertEqual(status, 409)
        self.assertEqual(response.get_json()["code"], "TOO_EARLY")

    def test_host_can_update_past_session(self):
        participant_query = MagicMock()
        participant_query.filter_by.return_value.first.return_value = self.participant
        checked_at = self.now - timedelta(days=1)
        attendance_row = SimpleNamespace(
            status="absent",
            checked_at=checked_at,
            to_dict=lambda: {"id": 20, "status": attendance_row.status},
        )
        attendance_query = MagicMock()
        attendance_query.filter_by.return_value.first.return_value = attendance_row
        db_mock = MagicMock()

        with self.app.test_request_context(json={"user_id": 2, "session_id": 10, "status": "present"}), \
             patch.object(meeting_routes.Meeting, "query", MagicMock(get_or_404=MagicMock(return_value=self.meeting))), \
             patch.object(meeting_routes.Participant, "query", participant_query), \
             patch.object(meeting_routes.Attendance, "query", attendance_query), \
             patch.object(meeting_routes, "db", db_mock), \
             patch.object(meeting_routes, "get_jwt_identity", return_value="1"), \
             patch.object(
                 meeting_routes,
                 "resolve_attendance_session",
                 return_value=(self.session, [], []),
             ), \
             patch.object(meeting_routes, "kst_now", return_value=self.now + timedelta(days=1)), \
             patch.object(meeting_routes, "refresh_user_attendance_rate", return_value=100.0):
            response = meeting_routes.check_attendance.__wrapped__(4)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(attendance_row.status, "present")
        self.assertEqual(attendance_row.checked_at, self.now + timedelta(days=1))
        db_mock.session.commit.assert_called_once()

    def test_qr_window_cannot_be_created_too_early(self):
        future_session = SimpleNamespace(
            **{
                **self.session.__dict__,
                "start_at": self.now + timedelta(minutes=31),
                "end_at": self.now + timedelta(hours=1),
            }
        )

        with self.app.test_request_context(json={"session_id": 10}), \
             patch.object(meeting_routes.Meeting, "query", MagicMock(get_or_404=MagicMock(return_value=self.meeting))), \
             patch.object(meeting_routes, "get_jwt_identity", return_value="1"), \
             patch.object(
                 meeting_routes,
                 "resolve_attendance_session",
                 return_value=(future_session, [], []),
             ), \
             patch.object(
                 meeting_routes,
                 "get_attendance_session_for_update",
                 return_value=future_session,
             ), \
             patch.object(meeting_routes, "kst_now", return_value=self.now):
            response, status = meeting_routes.create_attendance_checkin_window.__wrapped__(4)

        self.assertEqual(status, 409)
        self.assertEqual(response.get_json()["code"], "TOO_EARLY")

    def test_inactive_qr_is_rejected_after_schedule_change(self):
        self.session.meeting = self.meeting
        window = SimpleNamespace(
            meeting_session_id=10,
            is_active=False,
            opens_at=self.now - timedelta(minutes=30),
            closes_at=self.now + timedelta(hours=1),
            meeting_session=self.session,
        )
        window_query = MagicMock()
        window_query.options.return_value.filter_by.return_value.first.return_value = window

        with self.app.test_request_context(), \
             patch.object(meeting_routes.AttendanceCheckinWindow, "query", window_query), \
             patch.object(meeting_routes, "db", MagicMock()), \
             patch.object(
                 meeting_routes,
                 "get_attendance_session_for_update",
                 return_value=self.session,
             ), \
             patch.object(meeting_routes, "kst_now", return_value=self.now):
            response, status = meeting_routes.attendance_qr_checkin.__wrapped__("token")

        self.assertEqual(status, 409)
        self.assertEqual(response.get_json()["code"], "QR_INVALIDATED")

    def test_cancelled_session_reason_wins_for_old_qr(self):
        self.session.status = "cancelled"
        self.session.meeting = self.meeting
        window = SimpleNamespace(
            meeting_session_id=10,
            is_active=False,
            opens_at=self.now - timedelta(minutes=30),
            closes_at=self.now + timedelta(hours=1),
            meeting_session=self.session,
        )
        window_query = MagicMock()
        window_query.options.return_value.filter_by.return_value.first.return_value = window

        with self.app.test_request_context(), \
             patch.object(meeting_routes.AttendanceCheckinWindow, "query", window_query), \
             patch.object(meeting_routes, "db", MagicMock()), \
             patch.object(
                 meeting_routes,
                 "get_attendance_session_for_update",
                 return_value=self.session,
             ), \
             patch.object(meeting_routes, "kst_now", return_value=self.now):
            response, status = meeting_routes.attendance_qr_checkin.__wrapped__("token")

        self.assertEqual(status, 409)
        self.assertEqual(response.get_json()["code"], "SESSION_CANCELLED")

    def test_duplicate_qr_scan_preserves_original_checked_at(self):
        checked_at = self.now - timedelta(minutes=2)
        attendance_row = SimpleNamespace(
            status="present",
            checked_at=checked_at,
            to_dict=lambda: {"id": 20, "status": "present", "checked_at": attendance_row.checked_at.isoformat()},
        )
        self.session.meeting = self.meeting
        window = SimpleNamespace(
            meeting_session_id=10,
            is_active=True,
            opens_at=self.now - timedelta(minutes=30),
            closes_at=self.now + timedelta(hours=1),
            meeting_session=self.session,
        )
        window_query = MagicMock()
        window_query.options.return_value.filter_by.return_value.first.return_value = window
        participant_query = MagicMock()
        participant_query.filter_by.return_value.first.return_value = self.participant
        attendance_query = MagicMock()
        attendance_query.filter_by.return_value.first.return_value = attendance_row
        db_mock = MagicMock()

        with self.app.test_request_context(), \
             patch.object(meeting_routes.AttendanceCheckinWindow, "query", window_query), \
             patch.object(meeting_routes.Participant, "query", participant_query), \
             patch.object(meeting_routes.Attendance, "query", attendance_query), \
             patch.object(meeting_routes, "db", db_mock), \
             patch.object(meeting_routes, "get_jwt_identity", return_value="2"), \
             patch.object(
                 meeting_routes,
                 "get_attendance_session_for_update",
                 return_value=self.session,
             ), \
             patch.object(meeting_routes, "kst_now", return_value=self.now), \
             patch.object(meeting_routes, "refresh_user_attendance_rate", return_value=100.0):
            response = meeting_routes.attendance_qr_checkin.__wrapped__("token")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["already_checked_in"])
        self.assertEqual(attendance_row.checked_at, checked_at)
        db_mock.session.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
