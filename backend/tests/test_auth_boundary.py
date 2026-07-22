import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from flask import Flask

from app.routes.auth_routes import auth_bp
from app.services import auth_service


def make_user(auth_user_id, provider="google"):
    return SimpleNamespace(
        id=101,
        auth_user_id=auth_user_id,
        email="member@example.test",
        provider=provider,
        provider_id=auth_user_id,
        is_active=True,
        role="user",
        status="active",
        name="Member",
        phone_number=None,
        nickname="Member",
        user_tag="T101",
        profile_image_url=None,
        profile=SimpleNamespace(region="Busan", bio="Test", preferred_sports="Running"),
    )


class SyncSupabaseUserTests(unittest.TestCase):
    def run_sync(self, query_results, user, login_provider="google"):
        user_model = MagicMock()
        query = user_model.query.options.return_value
        query.filter_by.return_value.first.side_effect = query_results

        with (
            patch.object(auth_service, "User", user_model),
            patch.object(auth_service, "joinedload", return_value=None),
            patch.object(auth_service, "supabase_auth_user_exists", return_value=True),
            patch.object(auth_service, "check_withdraw_and_login", return_value=None),
            patch.object(auth_service, "build_auth_response", return_value={"access_token": "backend-token", "user": {"id": 101}}) as build_response,
            patch.object(auth_service.db.session, "commit") as commit,
            patch("app.utils.settings.load_system_settings", return_value={}),
        ):
            result = auth_service.sync_supabase_user({
                "auth_user_id": "verified-auth-id",
                "email": "member@example.test",
                "name": "Member",
                "nickname": "Member",
                "login_provider": login_provider,
            })

        self.assertEqual(result["access_token"], "backend-token")
        build_response.assert_called_once_with(user)
        commit.assert_called_once_with()
        return result

    def test_matching_auth_user_id_keeps_normal_sync(self):
        user = make_user("verified-auth-id")
        self.run_sync([user], user)
        self.assertEqual(user.auth_user_id, "verified-auth-id")

    def test_null_auth_user_id_is_linked_once(self):
        user = make_user(None)
        self.run_sync([None, user], user)
        self.assertEqual(user.auth_user_id, "verified-auth-id")

    def test_email_fallback_rejects_different_non_null_auth_user_id(self):
        user = make_user("different-stored-id")
        user_model = MagicMock()
        query = user_model.query.options.return_value
        query.filter_by.return_value.first.side_effect = [None, user]

        with (
            patch.object(auth_service, "User", user_model),
            patch.object(auth_service, "joinedload", return_value=None),
            patch.object(auth_service, "supabase_auth_user_exists", return_value=True),
            patch.object(auth_service.db.session, "commit") as commit,
            patch.object(auth_service, "build_auth_response") as build_response,
        ):
            with self.assertRaises(auth_service.AuthUserIdMismatchError):
                auth_service.sync_supabase_user({
                    "auth_user_id": "verified-auth-id",
                    "email": "member@example.test",
                    "name": "Member",
                    "nickname": "Member",
                    "login_provider": "google",
                })

        self.assertEqual(user.auth_user_id, "different-stored-id")
        self.assertEqual(user.provider, "google")
        commit.assert_not_called()
        build_response.assert_not_called()

    def test_existing_provider_mismatch_behavior_is_preserved(self):
        user = make_user("verified-auth-id", provider="google")
        user_model = MagicMock()
        query = user_model.query.options.return_value
        query.filter_by.return_value.first.return_value = user

        with (
            patch.object(auth_service, "User", user_model),
            patch.object(auth_service, "joinedload", return_value=None),
            patch.object(auth_service, "supabase_auth_user_exists", return_value=True),
            patch.object(auth_service.db.session, "commit") as commit,
        ):
            with self.assertRaises(auth_service.LoginProviderMismatchError):
                auth_service.sync_supabase_user({
                    "auth_user_id": "verified-auth-id",
                    "email": "member@example.test",
                    "name": "Member",
                    "nickname": "Member",
                    "login_provider": "kakao",
                })

        commit.assert_not_called()


class AuthRouteBoundaryTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
        app.config.update(TESTING=True)
        self.client = app.test_client()

    @staticmethod
    def sync_headers():
        return {"X-Supabase-Access-Token": "supabase-token"}

    @staticmethod
    def sync_payload():
        return {
            "auth_user_id": "verified-auth-id",
            "email": "member@example.test",
            "name": "Member",
            "nickname": "Member",
            "login_provider": "google",
        }

    @staticmethod
    def verified_user():
        return {
            "id": "verified-auth-id",
            "email": "member@example.test",
            "identities": [{"provider": "google"}],
        }

    def test_sync_returns_auth_user_id_mismatch_as_409(self):
        with (
            patch("app.routes.auth_routes.verify_supabase_user", return_value=self.verified_user()),
            patch("app.routes.auth_routes.sync_supabase_user", side_effect=auth_service.AuthUserIdMismatchError()),
        ):
            response = self.client.post(
                "/api/v1/auth/sync",
                json=self.sync_payload(),
                headers=self.sync_headers(),
            )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["error"], "AUTH_USER_ID_MISMATCH")
        self.assertNotIn("access_token", response.get_json())

    def test_normal_sync_response_is_preserved(self):
        with (
            patch("app.routes.auth_routes.verify_supabase_user", return_value=self.verified_user()),
            patch("app.routes.auth_routes.sync_supabase_user", return_value={"access_token": "backend-token", "user": {"id": 101}}),
        ):
            response = self.client.post(
                "/api/v1/auth/sync",
                json=self.sync_payload(),
                headers=self.sync_headers(),
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["access_token"], "backend-token")

    def test_provider_mismatch_response_is_preserved(self):
        with (
            patch("app.routes.auth_routes.verify_supabase_user", return_value=self.verified_user()),
            patch("app.routes.auth_routes.sync_supabase_user", side_effect=auth_service.LoginProviderMismatchError("google")),
        ):
            response = self.client.post(
                "/api/v1/auth/sync",
                json=self.sync_payload(),
                headers=self.sync_headers(),
            )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["code"], "LOGIN_PROVIDER_MISMATCH")

    def test_legacy_auth_routes_are_gone(self):
        for path in ("register", "login", "social-login"):
            with self.subTest(path=path):
                response = self.client.post(f"/api/v1/auth/{path}", json={"ignored": True})
                self.assertEqual(response.status_code, 410)
                self.assertEqual(response.get_json()["error"], "LEGACY_AUTH_DISABLED")
                self.assertNotIn("access_token", response.get_json())


if __name__ == "__main__":
    unittest.main()
