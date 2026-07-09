CREATE TABLE IF NOT EXISTS chatbot_user_memories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preferred_sports TEXT NOT NULL DEFAULT '',
  preferred_regions TEXT NOT NULL DEFAULT '',
  preferred_times TEXT NOT NULL DEFAULT '',
  interest_keywords TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  last_extracted_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  CONSTRAINT uq_chatbot_user_memories_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS ix_chatbot_user_memories_user_id
  ON chatbot_user_memories(user_id);
