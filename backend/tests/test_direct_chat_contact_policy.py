import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.services import chat_service


class DirectChatContactPolicyTests(unittest.TestCase):
    def target(self, policy):
        return SimpleNamespace(id=20, direct_message_policy=policy)

    def test_blocked_user_cannot_contact(self):
        with patch.object(chat_service, "direct_contact_is_blocked", return_value=True):
            self.assertEqual(chat_service.direct_contact_action(10, self.target("everyone")), "blocked")

    def test_same_meeting_policy_allows_shared_member(self):
        room_model = MagicMock()
        room_model.query.filter_by.return_value.first.return_value = None
        with patch.object(chat_service, "DirectChatRoom", room_model), \
             patch.object(chat_service, "direct_contact_is_blocked", return_value=False), \
             patch.object(chat_service, "users_share_meeting", return_value=True):
            self.assertEqual(chat_service.direct_contact_action(10, self.target("same_meeting")), "room")

    def test_everyone_policy_uses_request_for_outside_user(self):
        room_model = MagicMock()
        room_model.query.filter_by.return_value.first.return_value = None
        with patch.object(chat_service, "DirectChatRoom", room_model), \
             patch.object(chat_service, "direct_contact_is_blocked", return_value=False), \
             patch.object(chat_service, "users_share_meeting", return_value=False):
            self.assertEqual(chat_service.direct_contact_action(10, self.target("everyone")), "request")

    def test_none_policy_denies_new_contact(self):
        room_model = MagicMock()
        room_model.query.filter_by.return_value.first.return_value = None
        with patch.object(chat_service, "DirectChatRoom", room_model), \
             patch.object(chat_service, "direct_contact_is_blocked", return_value=False), \
             patch.object(chat_service, "users_share_meeting", return_value=True):
            self.assertEqual(chat_service.direct_contact_action(10, self.target("none")), "denied")


if __name__ == "__main__":
    unittest.main()
