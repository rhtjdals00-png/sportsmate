import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from flask import Flask

from app.services import meeting_service


class AttendanceScheduleConsistencyTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            SQLALCHEMY_DATABASE_URI="sqlite://",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
        )
        meeting_service.db.init_app(self.app)
        self.now = datetime(2026, 7, 23, 12, 0)
        self.session = SimpleNamespace(
            id=10,
            meeting_id=4,
            session_number=2,
            start_at=self.now + timedelta(days=1),
            end_at=self.now + timedelta(days=1, hours=1),
            status="scheduled",
            original_start_at=None,
            original_end_at=None,
            reschedule_reason=None,
            cancellation_reason=None,
        )
        self.meeting = SimpleNamespace(
            id=4,
            host_id=1,
            meeting_type="regular",
            title="테스트 모임",
        )

    def common_patches(self):
        return (
            patch.object(
                meeting_service,
                "_get_manageable_regular_session",
                return_value=(self.meeting, self.session),
            ),
            patch.object(meeting_service, "kst_now", return_value=self.now),
            patch.object(meeting_service, "_validate_session_time_conflict"),
            patch.object(meeting_service, "_session_notification_recipients", return_value=[]),
            patch.object(meeting_service, "_meeting_chat_room", return_value=SimpleNamespace(id=30)),
            patch.object(meeting_service, "_create_session_notice"),
            patch.object(meeting_service, "_send_session_pushes"),
            patch.object(meeting_service, "db", MagicMock()),
        )

    def run_patched(self, patches, callback):
        entered = []
        with self.app.app_context():
            try:
                for item in patches:
                    entered.append(item.start())
                return callback(), entered
            finally:
                for item in reversed(patches):
                    item.stop()

    def test_future_attendance_blocks_schedule_change(self):
        attendance_query = MagicMock()
        attendance_query.filter_by.return_value.first.return_value = SimpleNamespace(id=1)
        window_query = MagicMock()
        patches = (
            *self.common_patches(),
            patch.object(meeting_service.Attendance, "query", attendance_query),
            patch.object(meeting_service.AttendanceCheckinWindow, "query", window_query),
        )
        payload = {
            "start_at": "2026-07-25T12:00:00",
            "end_at": "2026-07-25T13:00:00",
            "reason": "시간 변경",
        }

        with self.assertRaises(meeting_service.FutureSessionAttendanceConflictError):
            self.run_patched(
                patches,
                lambda: meeting_service.update_meeting_session(4, 10, 1, payload),
            )

        window_query.filter_by.assert_not_called()

    def test_schedule_change_deactivates_active_qr_in_same_commit(self):
        attendance_query = MagicMock()
        attendance_query.filter_by.return_value.first.return_value = None
        window_query = MagicMock()
        db_mock = MagicMock()
        patches = list(self.common_patches())
        patches[-1] = patch.object(meeting_service, "db", db_mock)
        patches.extend((
            patch.object(meeting_service.Attendance, "query", attendance_query),
            patch.object(meeting_service.AttendanceCheckinWindow, "query", window_query),
        ))
        payload = {
            "start_at": "2026-07-25T12:00:00",
            "end_at": "2026-07-25T13:00:00",
            "reason": "시간 변경",
        }

        self.run_patched(
            tuple(patches),
            lambda: meeting_service.update_meeting_session(4, 10, 1, payload),
        )

        window_query.filter_by.assert_called_once_with(meeting_session_id=10, is_active=True)
        window_query.filter_by.return_value.update.assert_called_once_with(
            {"is_active": False},
            synchronize_session=False,
        )
        db_mock.session.commit.assert_called_once()

    def test_schedule_cancel_deactivates_active_qr(self):
        next_session_query = MagicMock()
        next_session_query.filter_by.return_value.filter.return_value.filter.return_value.order_by.return_value.first.return_value = None
        window_query = MagicMock()
        db_mock = MagicMock()
        patches = (
            patch.object(
                meeting_service,
                "_get_manageable_regular_session",
                return_value=(self.meeting, self.session),
            ),
            patch.object(meeting_service.MeetingSession, "query", next_session_query),
            patch.object(meeting_service.AttendanceCheckinWindow, "query", window_query),
            patch.object(meeting_service, "_session_notification_recipients", return_value=[]),
            patch.object(meeting_service, "_meeting_chat_room", return_value=SimpleNamespace(id=30)),
            patch.object(meeting_service, "_create_session_notice"),
            patch.object(meeting_service, "_send_session_pushes"),
            patch.object(meeting_service, "_session_attendance_user_ids", return_value=[2]),
            patch.object(meeting_service, "refresh_user_attendance_rate"),
            patch.object(meeting_service, "db", db_mock),
        )

        _, mocks = self.run_patched(
            patches,
            lambda: meeting_service.cancel_meeting_session(4, 10, 1, "우천"),
        )

        self.assertEqual(self.session.status, "cancelled")
        window_query.filter_by.assert_called_once_with(meeting_session_id=10, is_active=True)
        mocks[8].assert_called_once_with(2)
        db_mock.session.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
