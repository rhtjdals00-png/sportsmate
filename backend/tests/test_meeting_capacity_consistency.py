import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from flask import Flask

from app.models import Meeting, Participant
from app.routes import meeting_routes
from app.services import meeting_service


class MeetingCapacityConsistencyTests(unittest.TestCase):
    def setUp(self):
        self.meeting = SimpleNamespace(
            id=10,
            host_id=1,
            status="open",
            max_participants=6,
            current_participants=5,
            chat_room=SimpleNamespace(id=20),
            title="테스트 모임",
            sync_status=MagicMock(),
        )
        self.participant = SimpleNamespace(
            id=30,
            user_id=2,
            role="member",
            status="pending",
            approved_at=None,
            rejected_at=None,
            user=SimpleNamespace(nickname="참가자", name=None, email="member@example.com"),
        )
        self.db = MagicMock()

    def service_patches(self, approved_count=5, ended=False):
        return (
            patch.object(meeting_service, "db", self.db),
            patch.object(meeting_service, "get_meeting_for_update", return_value=self.meeting),
            patch.object(meeting_service, "get_participant_for_update", return_value=self.participant),
            patch.object(meeting_service, "approved_participant_count", return_value=approved_count),
            patch.object(meeting_service, "is_meeting_operation_ended", return_value=ended),
            patch.object(meeting_service, "recalculate_current_participants", return_value=approved_count + 1),
            patch.object(meeting_service, "_add_meeting_system_message"),
            patch.object(meeting_service, "create_notification"),
            patch.object(meeting_service, "send_web_push"),
        )

    def run_with_patches(self, patches, callback):
        entered = []
        try:
            for item in patches:
                entered.append(item.start())
            return callback(), entered
        finally:
            for item in reversed(patches):
                item.stop()

    def test_full_approval_returns_conflict_without_side_effects(self):
        patches = self.service_patches(approved_count=6)

        def exercise():
            with self.assertRaises(meeting_service.ParticipantApprovalCapacityFullError):
                meeting_service.update_application(10, 2, 1, "approved")

        _, mocks = self.run_with_patches(patches, exercise)
        self.assertEqual(self.participant.status, "pending")
        self.assertIsNone(self.participant.approved_at)
        self.db.session.commit.assert_not_called()
        self.db.session.rollback.assert_called_once()
        mocks[7].assert_not_called()
        mocks[8].assert_not_called()

    def test_last_slot_approval_commits_once(self):
        patches = self.service_patches(approved_count=5)

        result, mocks = self.run_with_patches(
            patches,
            lambda: meeting_service.update_application(10, 2, 1, "approved"),
        )

        self.assertIs(result, self.participant)
        self.assertEqual(self.participant.status, "approved")
        self.assertIsNotNone(self.participant.approved_at)
        self.db.session.commit.assert_called_once()
        self.db.session.rollback.assert_not_called()
        mocks[7].assert_called_once()
        mocks[8].assert_called_once()

    def test_duplicate_approval_does_not_repeat_side_effects(self):
        self.participant.status = "approved"
        patches = self.service_patches(approved_count=6)

        def exercise():
            with self.assertRaisesRegex(ValueError, "대기 중인 신청"):
                meeting_service.update_application(10, 2, 1, "approved")

        _, mocks = self.run_with_patches(patches, exercise)
        self.db.session.commit.assert_not_called()
        self.db.session.rollback.assert_called_once()
        mocks[7].assert_not_called()
        mocks[8].assert_not_called()

    def test_closed_meeting_keeps_pending_approval_policy(self):
        self.meeting.status = "closed"
        patches = self.service_patches(approved_count=5)

        result, _ = self.run_with_patches(
            patches,
            lambda: meeting_service.update_application(10, 2, 1, "approved"),
        )

        self.assertIs(result, self.participant)
        self.assertEqual(self.participant.status, "approved")
        self.db.session.commit.assert_called_once()

    def test_ended_meeting_rejects_approval(self):
        patches = self.service_patches(approved_count=5, ended=True)

        def exercise():
            with self.assertRaisesRegex(ValueError, "종료된 모임"):
                meeting_service.update_application(10, 2, 1, "approved")

        _, mocks = self.run_with_patches(patches, exercise)
        self.assertEqual(self.participant.status, "pending")
        self.db.session.commit.assert_not_called()
        mocks[7].assert_not_called()

    def test_cannot_reduce_max_below_approved_count(self):
        patches = (
            patch.object(meeting_service, "db", self.db),
            patch.object(meeting_service, "get_meeting_for_update", return_value=self.meeting),
            patch.object(meeting_service, "approved_participant_count", return_value=6),
            patch("app.utils.settings.load_system_settings", return_value={"defaultMaxParticipants": 10}),
        )

        def exercise():
            with self.assertRaises(meeting_service.MaxParticipantsBelowApprovedCountError):
                meeting_service.update_meeting(10, 1, {"max_participants": 4})

        self.run_with_patches(patches, exercise)
        self.assertEqual(self.meeting.max_participants, 6)
        self.assertEqual(self.meeting.current_participants, 5)
        self.db.session.commit.assert_not_called()
        self.db.session.rollback.assert_called_once()

    def test_can_set_max_equal_to_approved_count(self):
        patches = (
            patch.object(meeting_service, "db", self.db),
            patch.object(meeting_service, "get_meeting_for_update", return_value=self.meeting),
            patch.object(meeting_service, "approved_participant_count", return_value=5),
            patch("app.utils.settings.load_system_settings", return_value={"defaultMaxParticipants": 10}),
        )

        result, _ = self.run_with_patches(
            patches,
            lambda: meeting_service.update_meeting(10, 1, {"max_participants": 5}),
        )

        self.assertIs(result, self.meeting)
        self.assertEqual(self.meeting.max_participants, 5)
        self.assertEqual(self.meeting.current_participants, 5)
        self.db.session.commit.assert_called_once()
        self.meeting.sync_status.assert_called_once()

    def test_lock_helpers_use_for_update(self):
        app = Flask(__name__)
        app.config.update(
            SQLALCHEMY_DATABASE_URI="sqlite://",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
        )
        meeting_service.db.init_app(app)
        meeting_query = MagicMock()
        participant_query = MagicMock()
        meeting_query.filter_by.return_value.with_for_update.return_value.first_or_404.return_value = self.meeting
        participant_query.filter_by.return_value.with_for_update.return_value.first_or_404.return_value = self.participant

        with app.app_context():
            with patch.object(Meeting, "query", meeting_query), patch.object(Participant, "query", participant_query):
                self.assertIs(meeting_service.get_meeting_for_update(10), self.meeting)
                self.assertIs(meeting_service.get_participant_for_update(10, 2), self.participant)

        meeting_query.filter_by.return_value.with_for_update.assert_called_once_with()
        participant_query.filter_by.return_value.with_for_update.assert_called_once_with()

    def test_approval_capacity_conflict_route_returns_409_code(self):
        app = Flask(__name__)
        error = meeting_service.ParticipantApprovalCapacityFullError()

        with app.app_context(), \
             patch.object(meeting_routes, "get_jwt_identity", return_value="1"), \
             patch.object(meeting_routes, "update_application", side_effect=error):
            response, status = meeting_routes.approve.__wrapped__(10, 2)

        self.assertEqual(status, 409)
        self.assertEqual(response.get_json()["code"], "PARTICIPANT_APPROVAL_CAPACITY_FULL")

    def test_max_below_approved_route_returns_409_code(self):
        app = Flask(__name__)
        error = meeting_service.MaxParticipantsBelowApprovedCountError()

        with app.test_request_context(json={"max_participants": 4}), \
             patch.object(meeting_routes, "get_jwt_identity", return_value="1"), \
             patch.object(meeting_routes, "update_meeting", side_effect=error):
            response, status = meeting_routes.update.__wrapped__(10)

        self.assertEqual(status, 409)
        self.assertEqual(response.get_json()["code"], "MAX_PARTICIPANTS_BELOW_APPROVED_COUNT")


if __name__ == "__main__":
    unittest.main()
