ALTER TABLE users
    ADD COLUMN IF NOT EXISTS direct_message_policy VARCHAR(30) NOT NULL DEFAULT 'same_meeting';

CREATE TABLE IF NOT EXISTS direct_chat_requests (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    recipient_id INTEGER NOT NULL REFERENCES users(id),
    message VARCHAR(500) NOT NULL DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    responded_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_direct_chat_request_pending
    ON direct_chat_requests(sender_id, recipient_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS ix_direct_chat_requests_sender_id
    ON direct_chat_requests(sender_id);

CREATE INDEX IF NOT EXISTS ix_direct_chat_requests_recipient_id
    ON direct_chat_requests(recipient_id);

CREATE INDEX IF NOT EXISTS ix_direct_chat_requests_status
    ON direct_chat_requests(status);

CREATE TABLE IF NOT EXISTS user_blocks (
    id SERIAL PRIMARY KEY,
    blocker_id INTEGER NOT NULL REFERENCES users(id),
    blocked_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_block_pair UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS ix_user_blocks_blocker_id ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS ix_user_blocks_blocked_id ON user_blocks(blocked_id);
