ALTER TABLE direct_chat_rooms
    ADD COLUMN IF NOT EXISTS user_a_left_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS user_b_left_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS ended_by_user_id INTEGER REFERENCES users(id);

UPDATE direct_chat_rooms
SET user_a_left_at = COALESCE(user_a_left_at, ended_at)
WHERE is_active = FALSE
  AND ended_by_user_id = user_a_id;

UPDATE direct_chat_rooms
SET user_b_left_at = COALESCE(user_b_left_at, ended_at)
WHERE is_active = FALSE
  AND ended_by_user_id = user_b_id;

ALTER TABLE direct_chat_rooms
    DROP CONSTRAINT IF EXISTS uq_direct_chat_pair;

CREATE UNIQUE INDEX IF NOT EXISTS uq_direct_chat_pair_active
    ON direct_chat_rooms(user_a_id, user_b_id)
    WHERE is_active = TRUE;

INSERT INTO direct_chat_messages (
    direct_chat_room_id,
    sender_id,
    content,
    message_type,
    created_at
)
SELECT
    room.id,
    room.ended_by_user_id,
    '상대방이 채팅방을 나갔습니다.',
    'system',
    COALESCE(room.ended_at, room.updated_at, CURRENT_TIMESTAMP)
FROM direct_chat_rooms AS room
WHERE room.is_active = FALSE
  AND room.ended_by_user_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM direct_chat_messages AS message
      WHERE message.direct_chat_room_id = room.id
        AND message.message_type = 'system'
        AND message.content = '상대방이 채팅방을 나갔습니다.'
  );
