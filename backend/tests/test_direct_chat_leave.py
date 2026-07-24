import unittest
from datetime import datetime

from app.models import DirectChatRoom


class DirectChatLeaveTests(unittest.TestCase):
    def setUp(self):
        self.room = DirectChatRoom(user_a_id=10, user_b_id=20, is_active=True)
        self.left_at = datetime(2026, 7, 24, 18, 0)

    def test_leaving_ends_the_room_for_both_users(self):
        self.room.end(10, self.left_at)

        self.assertFalse(self.room.is_active)
        self.assertEqual(self.room.ended_at, self.left_at)
        self.assertEqual(self.room.ended_by_user_id, 10)
        self.assertEqual(self.room.user_a_left_at, self.left_at)
        self.assertIsNone(self.room.user_b_left_at)
        self.assertTrue(self.room.has_left(10))
        self.assertFalse(self.room.has_left(20))

    def test_non_member_cannot_end_the_room(self):
        self.room.end(30, self.left_at)

        self.assertTrue(self.room.is_active)
        self.assertIsNone(self.room.ended_at)
        self.assertIsNone(self.room.user_a_left_at)
        self.assertIsNone(self.room.user_b_left_at)

    def test_remaining_user_can_hide_an_ended_room(self):
        self.room.end(10, self.left_at)
        second_left_at = datetime(2026, 7, 24, 19, 0)

        self.room.mark_left(20, second_left_at)

        self.assertEqual(self.room.user_a_left_at, self.left_at)
        self.assertEqual(self.room.user_b_left_at, second_left_at)
        self.assertEqual(self.room.ended_by_user_id, 10)
        self.assertEqual(self.room.ended_at, self.left_at)


if __name__ == "__main__":
    unittest.main()
