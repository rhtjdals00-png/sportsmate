import unittest
from unittest.mock import MagicMock, patch
from flask import Flask, jsonify
from flask_jwt_extended import JWTManager, create_access_token

from app.routes.admin_routes import admin_bp
from app.routes.meeting_routes import meeting_bp
from app.routes.location_routes import location_bp
from app.routes.user_routes import user_bp


class AdminSecurityTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config["JWT_SECRET_KEY"] = "super-secret"
        self.app.config["TESTING"] = True
        JWTManager(self.app)
        self.app.register_blueprint(admin_bp, url_prefix="/api/v1/admin")
        self.app.register_blueprint(meeting_bp, url_prefix="/api/v1/meetings")
        self.app.register_blueprint(location_bp, url_prefix="/api/v1/locations")
        self.app.register_blueprint(user_bp, url_prefix="/api/v1/users")
        self.client = self.app.test_client()

    def test_endpoints_without_jwt_returns_401(self):
        paths = [
            "/api/v1/admin/users", "/api/v1/admin/users/1", 
            "/api/v1/admin/meetings", "/api/v1/admin/meetings/1",
            "/api/v1/admin/settings", "/api/v1/admin/settings/logs", "/api/v1/admin/settings/defaults"
        ]
        for path in paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 401)

    @patch("app.routes.admin_routes.User")
    @patch("app.routes.admin_routes.joinedload")
    def test_endpoints_with_regular_user_jwt_returns_403(self, mock_joinedload, mock_user_cls):
        mock_joinedload.return_value = MagicMock()
        mock_regular_user = MagicMock()
        mock_regular_user.role = "user"
        
        mock_user_cls.query.options.return_value.get.return_value = mock_regular_user
        mock_user_cls.query.get.return_value = mock_regular_user

        with self.app.app_context():
            token = create_access_token(identity="101")
            headers = {"Authorization": f"Bearer {token}"}

        paths = [
            "/api/v1/admin/users", "/api/v1/admin/users/1", 
            "/api/v1/admin/meetings", "/api/v1/admin/meetings/1",
            "/api/v1/admin/settings", "/api/v1/admin/settings/logs", "/api/v1/admin/settings/defaults"
        ]
        for path in paths:
            with self.subTest(path=path):
                response = self.client.get(path, headers=headers)
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.get_json()["message"], "관리자 권한이 필요합니다.")

    @patch("app.routes.admin_routes.User")
    @patch("app.routes.admin_routes.Meeting")
    @patch("app.routes.admin_routes.joinedload")
    @patch("app.utils.settings.load_system_settings")
    @patch("app.utils.settings.load_settings_logs")
    @patch("app.utils.settings.load_system_defaults")
    def test_endpoints_with_admin_jwt_returns_200(self, mock_load_defaults, mock_load_logs, mock_load_settings, mock_joinedload, mock_meeting_cls, mock_user_cls):
        mock_joinedload.return_value = MagicMock()
        mock_load_settings.return_value = {}
        mock_load_logs.return_value = []
        mock_load_defaults.return_value = {}

        mock_admin_user = MagicMock()
        mock_admin_user.role = "admin"
        
        mock_user_cls.query.options.return_value.get.side_effect = lambda uid: mock_admin_user if uid == 101 else MagicMock()
        mock_user_cls.query.get.return_value = mock_admin_user
        
        mock_user_cls.query.options.return_value.order_by.return_value.limit.return_value.all.return_value = []
        mock_meeting_cls.query.options.return_value.order_by.return_value.limit.return_value.all.return_value = []

        with self.app.app_context():
            token = create_access_token(identity="101")
            headers = {"Authorization": f"Bearer {token}"}

        paths = [
            "/api/v1/admin/users", "/api/v1/admin/meetings",
            "/api/v1/admin/settings", "/api/v1/admin/settings/logs", "/api/v1/admin/settings/defaults"
        ]
        for path in paths:
            with self.subTest(path=path):
                response = self.client.get(path, headers=headers)
                self.assertEqual(response.status_code, 200)

    def test_user_to_dict_privacy_filtering(self):
        from app.models.users import User
        user = User(
            id=999,
            auth_user_id="test-auth-id",
            email="test@example.com",
            name="Real Name",
            phone_number="010-1234-5678",
            nickname="Nick",
            user_tag="TAG1",
            role="user",
            status="active"
        )
        
        # Test default to_dict() (include_private=False)
        public_data = user.to_dict()
        self.assertNotIn("auth_user_id", public_data)
        self.assertNotIn("email", public_data)
        self.assertNotIn("name", public_data)
        self.assertNotIn("phone_number", public_data)
        self.assertEqual(public_data["nickname"], "Nick")
        
        # Test to_dict(include_private=True)
        private_data = user.to_dict(include_private=True)
        self.assertEqual(private_data["auth_user_id"], "test-auth-id")
        self.assertEqual(private_data["email"], "test@example.com")
        self.assertEqual(private_data["name"], "Real Name")
        self.assertEqual(private_data["phone_number"], "010-1234-5678")

    # S4 Test: Notice, Review, Vote non-member access check
    @patch("app.routes.meeting_routes.Meeting")
    @patch("app.routes.meeting_routes.Participant")
    @patch("app.routes.meeting_routes.joinedload")
    def test_meeting_internal_data_non_member_blocked(self, mock_joinedload, mock_participant_cls, mock_meeting_cls):
        mock_joinedload.return_value = MagicMock()
        mock_meeting = MagicMock()
        mock_meeting.id = 1
        mock_meeting.host_id = 100
        mock_meeting_cls.query.get_or_404.return_value = mock_meeting
        
        # Mock Participant query to return None (user not a member)
        mock_participant_cls.query.filter_by.return_value.first.return_value = None

        with self.app.app_context():
            token = create_access_token(identity="101")
            headers = {"Authorization": f"Bearer {token}"}

        paths = [
            "/api/v1/meetings/1/reviews",
            "/api/v1/meetings/1/notices",
            "/api/v1/meetings/1/votes"
        ]
        for path in paths:
            with self.subTest(path=path):
                # Without JWT -> 401
                response = self.client.get(path)
                self.assertEqual(response.status_code, 401)
                
                # With JWT but not a member -> 403
                response = self.client.get(path, headers=headers)
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.get_json()["message"], "모임 멤버만 조회할 수 있습니다.")

    # S6 Test: Region sync endpoint JWT check and admin check
    @patch("app.routes.location_routes.sync_regions_from_configured_api")
    @patch("app.models.users.User")
    def test_region_sync_requires_jwt_and_admin(self, mock_user_cls, mock_sync_api):
        mock_sync_api.return_value = {"success": True}
        
        # 1. Without JWT -> 401
        response = self.client.post("/api/v1/locations/regions/sync")
        self.assertEqual(response.status_code, 401)

        # 2. With JWT but as a regular user -> 403
        mock_regular_user = MagicMock()
        mock_regular_user.role = "user"
        mock_user_cls.query.get.return_value = mock_regular_user
        
        with self.app.app_context():
            token = create_access_token(identity="101")
            headers = {"Authorization": f"Bearer {token}"}
            
        response = self.client.post("/api/v1/locations/regions/sync", headers=headers)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json()["message"], "관리자 권한이 필요합니다.")

        # 3. With JWT as an admin -> 200
        mock_admin_user = MagicMock()
        mock_admin_user.role = "admin"
        mock_user_cls.query.get.return_value = mock_admin_user

        response = self.client.post("/api/v1/locations/regions/sync", headers=headers)
        self.assertEqual(response.status_code, 200)

    # S7 Test: Verify Password checking actual password hash
    @patch("app.routes.user_routes.User")
    @patch("app.routes.user_routes.joinedload")
    def test_verify_password_logic(self, mock_joinedload, mock_user_cls):
        # Clear rate limits before running test
        from app.routes.user_routes import _verify_attempts
        _verify_attempts.clear()

        mock_joinedload.return_value = MagicMock()
        mock_user = MagicMock()
        mock_user.id = 101
        mock_user.provider = "email"
        mock_user.password_hash = "mock-hash"
        
        # When correct password, check_password returns True
        mock_user.check_password.side_effect = lambda pw: pw == "correct-pw"
        
        mock_user_cls.query.options.return_value.get_or_404.return_value = mock_user

        with self.app.app_context():
            token = create_access_token(identity="101")
            headers = {"Authorization": f"Bearer {token}"}

        # Incorrect password -> 400
        response = self.client.post(
            "/api/v1/users/me/verify-password",
            json={"password": "wrong-password"},
            headers=headers
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["verified"], False)

        # Correct password -> 200
        response = self.client.post(
            "/api/v1/users/me/verify-password",
            json={"password": "correct-pw"},
            headers=headers
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["verified"], True)

    # S7 Test: Verify Password Rate Limiting (429)
    @patch("app.routes.user_routes.User")
    @patch("app.routes.user_routes.joinedload")
    def test_verify_password_rate_limiting(self, mock_joinedload, mock_user_cls):
        # Clear rate limits before running test
        from app.routes.user_routes import _verify_attempts
        _verify_attempts.clear()

        mock_joinedload.return_value = MagicMock()
        mock_user = MagicMock()
        mock_user.id = 101
        mock_user.provider = "email"
        mock_user.password_hash = "mock-hash"
        mock_user.check_password.return_value = True
        mock_user_cls.query.options.return_value.get_or_404.return_value = mock_user

        with self.app.app_context():
            token = create_access_token(identity="101")
            headers = {"Authorization": f"Bearer {token}"}

        # Call verify-password 5 times (should succeed/fail normally, not rate limited)
        for i in range(5):
            response = self.client.post(
                "/api/v1/users/me/verify-password",
                json={"password": "correct-pw"},
                headers=headers
            )
            self.assertEqual(response.status_code, 200)

        # 6th attempt should be blocked by rate limit -> 429
        response = self.client.post(
            "/api/v1/users/me/verify-password",
            json={"password": "correct-pw"},
            headers=headers
        )
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.get_json()["message"], "너무 많은 비밀번호 확인 시도가 있었습니다. 잠시 후 다시 시도해주세요.")


if __name__ == "__main__":
    unittest.main()
