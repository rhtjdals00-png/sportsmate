import unittest
from datetime import timedelta
from unittest.mock import patch

from flask import Flask

from app.extensions import db, jwt
from app.models import (
    DirectChatRoom,
    Meeting,
    Participant,
    PushSubscription,
    Sport,
    SportCategory,
    User,
    UserProfile,
)
from app.routes.auth_routes import auth_bp
from app.services import auth_service
from app.services.chat_service import send_direct_message
from app.utils.timezone import kst_now


class AccountWithdrawalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = Flask(__name__)
        cls.app.config.update(
            SQLALCHEMY_DATABASE_URI="sqlite://",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
            JWT_SECRET_KEY="test-secret-key-that-is-long-enough",
        )
        db.init_app(cls.app)
        jwt.init_app(cls.app)
        cls.app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
        cls.context = cls.app.app_context()
        cls.context.push()
        db.create_all()

    @classmethod
    def tearDownClass(cls):
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        cls.context.pop()

    def setUp(self):
        db.session.remove()
        for table in reversed(db.metadata.sorted_tables):
            db.session.execute(table.delete())
        db.session.commit()

    @staticmethod
    def create_user(index, **overrides):
        user = User(
            auth_user_id=overrides.pop("auth_user_id", f"auth-{index}"),
            email=overrides.pop("email", f"user{index}@example.test"),
            name=overrides.pop("name", f"User {index}"),
            nickname=overrides.pop("nickname", f"user{index}"),
            user_tag=overrides.pop("user_tag", f"U{index:03}"[-4:]),
            provider=overrides.pop("provider", "google"),
            provider_id=overrides.pop("provider_id", f"auth-{index}"),
            **overrides,
        )
        user.profile = UserProfile(
            region="서울",
            bio="소개",
            exercise_level="beginner",
            preferred_sports="러닝",
            preferred_sport_levels="{}",
        )
        db.session.add(user)
        db.session.flush()
        return user

    @staticmethod
    def create_sport():
        category = SportCategory(name="구기", purpose="운동")
        sport = Sport(name="축구", category=category)
        db.session.add(sport)
        db.session.flush()
        return sport

    def create_meeting(self, host, sport, *, start_at=None, end_at=None, status="open"):
        meeting = Meeting(
            host_id=host.id,
            sport_id=sport.id,
            title="테스트 모임",
            description="설명",
            meeting_type="one_time",
            purpose="친목",
            location_name="장소",
            address="주소",
            start_at=start_at or (kst_now() + timedelta(days=3)),
            end_at=end_at or (kst_now() + timedelta(days=3, hours=2)),
            max_participants=6,
            current_participants=1,
            status=status,
        )
        db.session.add(meeting)
        db.session.flush()
        return meeting

    def test_withdrawal_cancels_active_participation_and_disables_push(self):
        user = self.create_user(1)
        host = self.create_user(2)
        sport = self.create_sport()
        meeting = self.create_meeting(host, sport)
        host_participant = Participant(
            meeting_id=meeting.id,
            user_id=host.id,
            role="host",
            status="approved",
        )
        user_participant = Participant(
            meeting_id=meeting.id,
            user_id=user.id,
            role="member",
            status="approved",
        )
        meeting.current_participants = 2
        subscription = PushSubscription(
            user_id=user.id,
            endpoint="https://push.example.test/1",
            p256dh="key",
            auth="auth",
            is_active=True,
        )
        db.session.add_all([host_participant, user_participant, subscription])
        db.session.commit()

        auth_service.request_withdrawal(user.id)
        db.session.commit()

        self.assertEqual(user.status, "withdrawn_pending")
        self.assertEqual(user.role, "pending_withdrawal")
        self.assertEqual(user_participant.status, "cancelled")
        self.assertEqual(meeting.current_participants, 1)
        self.assertFalse(subscription.is_active)

    def test_active_host_must_transfer_or_end_meeting_before_withdrawal(self):
        host = self.create_user(1)
        sport = self.create_sport()
        self.create_meeting(host, sport)
        db.session.commit()

        with self.assertRaises(auth_service.AccountLifecycleError) as raised:
            auth_service.request_withdrawal(host.id)

        self.assertEqual(raised.exception.code, "ACTIVE_HOST_MEETINGS_EXIST")
        self.assertEqual(host.status, "active")

    def test_restore_uses_auth_identity_and_keeps_original_user_id(self):
        user = self.create_user(
            1,
            status="withdrawn_pending",
            role="pending_withdrawal",
            withdrawn_at=kst_now() - timedelta(days=10),
            deleted_at=kst_now() - timedelta(days=10),
        )
        original_id = user.id
        db.session.commit()

        response = auth_service.restore_user(user.auth_user_id)

        self.assertEqual(response["user"]["id"], original_id)
        self.assertEqual(user.status, "active")
        self.assertEqual(user.role, "user")
        self.assertTrue(user.is_active)
        self.assertIsNone(user.withdrawn_at)

    def test_expired_withdrawal_anonymizes_old_user_and_creates_new_active_user(self):
        old_user = self.create_user(
            1,
            status="withdrawn_pending",
            role="pending_withdrawal",
            withdrawn_at=kst_now() - timedelta(days=31),
            deleted_at=kst_now() - timedelta(days=31),
        )
        old_user_id = old_user.id
        auth_user_id = old_user.auth_user_id
        old_email = old_user.email
        host = self.create_user(2)
        sport = self.create_sport()
        ended_meeting = self.create_meeting(
            host,
            sport,
            start_at=kst_now() - timedelta(days=10),
            end_at=kst_now() - timedelta(days=10, hours=-2),
            status="closed",
        )
        historical_participant = Participant(
            meeting_id=ended_meeting.id,
            user_id=old_user.id,
            status="approved",
        )
        db.session.add(historical_participant)
        db.session.commit()

        payload = {
            "auth_user_id": auth_user_id,
            "email": old_email,
            "name": "New User",
            "nickname": "new_user",
            "login_provider": "google",
        }
        with (
            patch.object(auth_service, "supabase_auth_user_exists", return_value=True),
            patch("app.utils.settings.load_system_settings", return_value={}),
        ):
            response = auth_service.sync_supabase_user(payload)

        db.session.expire_all()
        anonymized = db.session.get(User, old_user_id)
        new_user = User.query.filter_by(auth_user_id=auth_user_id).one()

        self.assertEqual(anonymized.status, "anonymized")
        self.assertFalse(anonymized.is_active)
        self.assertIsNone(anonymized.auth_user_id)
        self.assertIsNone(anonymized.phone_number)
        self.assertTrue(anonymized.email.endswith("@anonymous.invalid"))
        self.assertEqual(anonymized.to_dict()["nickname"], "탈퇴한 사용자")
        self.assertNotEqual(new_user.id, old_user_id)
        self.assertEqual(new_user.status, "active")
        self.assertEqual(new_user.role, "user")
        self.assertTrue(new_user.is_active)
        self.assertEqual(new_user.profile.preferred_sports, "")
        self.assertEqual(
            Participant.query.filter_by(id=historical_participant.id).one().user_id,
            old_user_id,
        )
        self.assertFalse(response["profile_complete"])
        self.assertTrue(response["profile_intro_required"])
        self.assertTrue(response["account_recreated"])

    def test_recreation_failure_rolls_back_anonymization(self):
        old_user = self.create_user(
            1,
            status="withdrawn_pending",
            role="pending_withdrawal",
            withdrawn_at=kst_now() - timedelta(days=31),
            deleted_at=kst_now() - timedelta(days=31),
        )
        old_user_id = old_user.id
        auth_user_id = old_user.auth_user_id
        old_email = old_user.email
        db.session.commit()

        with patch.object(
            auth_service,
            "_new_user_from_verified_identity",
            side_effect=RuntimeError("forced failure"),
        ):
            with self.assertRaises(auth_service.AccountLifecycleError) as raised:
                auth_service.recreate_expired_withdrawal(old_user, {
                    "auth_user_id": auth_user_id,
                    "email": old_email,
                    "name": "New User",
                    "nickname": "new_user",
                    "login_provider": "google",
                })

        db.session.expire_all()
        preserved = db.session.get(User, old_user_id)
        self.assertEqual(raised.exception.code, "ACCOUNT_RECREATION_FAILED")
        self.assertEqual(preserved.status, "withdrawn_pending")
        self.assertEqual(preserved.auth_user_id, auth_user_id)
        self.assertEqual(preserved.email, old_email)
        self.assertEqual(User.query.count(), 1)

    def test_expired_target_keeps_direct_history_but_blocks_new_message(self):
        active_user = self.create_user(1)
        anonymized_user = self.create_user(
            2,
            status="anonymized",
            is_active=False,
            auth_user_id=None,
            provider_id=None,
        )
        room = DirectChatRoom(user_a_id=active_user.id, user_b_id=anonymized_user.id)
        db.session.add(room)
        db.session.commit()

        with self.assertRaisesRegex(ValueError, "탈퇴한 사용자"):
            send_direct_message(room.id, active_user.id, {"content": "새 메시지"})

        self.assertIsNotNone(db.session.get(DirectChatRoom, room.id))

    def test_restore_route_requires_and_verifies_supabase_token(self):
        client = self.app.test_client()
        missing_token = client.post("/api/v1/auth/restore")
        self.assertEqual(missing_token.status_code, 401)

        with (
            patch(
                "app.routes.auth_routes.verify_supabase_user",
                return_value={"id": "verified-auth-id"},
            ),
            patch(
                "app.routes.auth_routes.restore_user",
                return_value={"access_token": "backend-token", "user": {"id": 7}},
            ) as restore,
        ):
            response = client.post(
                "/api/v1/auth/restore",
                headers={"X-Supabase-Access-Token": "supabase-token"},
            )

        self.assertEqual(response.status_code, 200)
        restore.assert_called_once_with("verified-auth-id")


if __name__ == "__main__":
    unittest.main()
