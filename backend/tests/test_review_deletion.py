import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from flask import Flask

from app.routes import user_routes
from app.services import meeting_service


class MockColumn:
    def __ge__(self, other):
        return True
    def __eq__(self, other):
        return True


class ReviewDeletionTests(unittest.TestCase):
    def setUp(self):
        self.db = MagicMock()
        self.review = SimpleNamespace(id=7, reviewer_id=11, reviewee_id=22, rating=5, content="good")
        self.profile = SimpleNamespace(rating_average=0.0)
        self.review_query = MagicMock()
        self.review_query.get.return_value = self.review
        self.profile_query = MagicMock()
        self.profile_query.filter_by.return_value.first.return_value = self.profile
        self.average_query = self.db.session.query.return_value.filter.return_value
        self.average_query.scalar.return_value = 4.125

    def service_context(self):
        return (
            patch.object(meeting_service, "db", self.db),
            patch.object(meeting_service, "Review", SimpleNamespace(query=self.review_query, rating=MockColumn(), reviewee_id=MockColumn())),
            patch("app.models.users.UserProfile", SimpleNamespace(query=self.profile_query)),
        )

    def run_service(self):
        patches = self.service_context()
        for item in patches:
            item.start()
        try:
            return meeting_service.delete_review(7, 11)
        finally:
            for item in reversed(patches):
                item.stop()

    def test_delete_recalculates_rating_to_two_decimals_and_commits_once(self):
        self.run_service()

        self.assertEqual(self.review.rating, -1)
        self.assertEqual(self.review.content, "__DELETED__")
        self.assertEqual(self.profile.rating_average, 4.12)
        self.db.session.commit.assert_called_once()
        self.db.session.rollback.assert_not_called()

    def test_delete_last_review_resets_rating(self):
        self.average_query.scalar.return_value = None

        self.run_service()

        self.assertEqual(self.profile.rating_average, 0.0)
        self.db.session.commit.assert_called_once()

    def test_missing_review_does_not_change_database(self):
        self.review_query.get.return_value = None
        patches = self.service_context()
        for item in patches:
            item.start()
        try:
            with self.assertRaises(meeting_service.ReviewNotFoundError):
                meeting_service.delete_review(999, 11)
        finally:
            for item in reversed(patches):
                item.stop()

        self.db.session.commit.assert_not_called()
        self.db.session.rollback.assert_not_called()

    def test_other_users_review_returns_permission_error_without_writes(self):
        with patch.object(meeting_service, "db", self.db), \
             patch.object(meeting_service, "Review", SimpleNamespace(query=self.review_query)):
            with self.assertRaises(PermissionError):
                meeting_service.delete_review(7, 99)

        self.db.session.commit.assert_not_called()

    def test_rating_failure_rolls_back_delete(self):
        self.average_query.scalar.side_effect = RuntimeError("forced failure")
        patches = self.service_context()
        for item in patches:
            item.start()
        try:
            with self.assertRaisesRegex(RuntimeError, "forced failure"):
                meeting_service.delete_review(7, 11)
        finally:
            for item in reversed(patches):
                item.stop()

        self.assertEqual(self.review.rating, -1)
        self.db.session.commit.assert_not_called()
        self.db.session.rollback.assert_called_once()

    def test_commit_failure_rolls_back_delete(self):
        self.db.session.commit.side_effect = RuntimeError("commit failure")
        patches = self.service_context()
        for item in patches:
            item.start()
        try:
            with self.assertRaisesRegex(RuntimeError, "commit failure"):
                meeting_service.delete_review(7, 11)
        finally:
            for item in reversed(patches):
                item.stop()

        self.db.session.rollback.assert_called_once()

    def test_route_preserves_success_not_found_and_permission_statuses(self):
        app = Flask(__name__)
        cases = [
            (None, 200),
            (meeting_service.ReviewNotFoundError("존재하지 않는 후기입니다."), 404),
            (PermissionError("본인이 작성한 후기만 삭제할 수 있습니다."), 403),
            (RuntimeError("private stack detail"), 500),
        ]

        for error, expected_status in cases:
            with self.subTest(expected_status=expected_status), app.app_context(), \
                 patch.object(user_routes, "get_jwt_identity", return_value="11"), \
                 patch.object(meeting_service, "delete_review", side_effect=error):
                result = user_routes.delete_my_review.__wrapped__(7)
                response, status = result if isinstance(result, tuple) else (result, 200)
                self.assertEqual(status, expected_status)
                self.assertIn("message", response.get_json())
                self.assertNotIn("private stack detail", response.get_json()["message"])


if __name__ == "__main__":
    unittest.main()
