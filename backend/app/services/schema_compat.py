from sqlalchemy import inspect, text

from app.extensions import db


CHAT_MESSAGE_COLUMNS = {
    "attachment_url": "TEXT",
    "attachment_name": "VARCHAR(255)",
    "location_latitude": "DOUBLE PRECISION",
    "location_longitude": "DOUBLE PRECISION",
    "location_label": "VARCHAR(255)",
    "reply_to_message_id": "INTEGER",
    "reply_to_user_id": "INTEGER",
    "reply_to_sender_name": "VARCHAR(120)",
    "reply_to_content": "TEXT",
    "reply_to_message_type": "VARCHAR(30)",
}


def ensure_chat_schema(app):
    try:
        inspector = inspect(db.engine)
        existing = {column["name"] for column in inspector.get_columns("chat_messages")}
        missing = [(name, column_type) for name, column_type in CHAT_MESSAGE_COLUMNS.items() if name not in existing]
        with db.engine.begin() as connection:
            for name, column_type in missing:
                connection.execute(text(f"ALTER TABLE chat_messages ADD COLUMN {name} {column_type}"))
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS chat_message_reads (
                    id SERIAL PRIMARY KEY,
                    chat_message_id INTEGER NOT NULL REFERENCES chat_messages(id),
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_chat_message_read_user UNIQUE (chat_message_id, user_id)
                )
            """))
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS direct_chat_rooms (
                    id SERIAL PRIMARY KEY,
                    user_a_id INTEGER NOT NULL REFERENCES users(id),
                    user_b_id INTEGER NOT NULL REFERENCES users(id),
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    CONSTRAINT uq_direct_chat_pair UNIQUE (user_a_id, user_b_id)
                )
            """))
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS direct_chat_messages (
                    id SERIAL PRIMARY KEY,
                    direct_chat_room_id INTEGER NOT NULL REFERENCES direct_chat_rooms(id),
                    sender_id INTEGER NOT NULL REFERENCES users(id),
                    content TEXT NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """))
    except Exception as error:
        app.logger.warning("Chat message schema compatibility check failed: %s", error)


def ensure_chat_message_columns(app):
    ensure_chat_schema(app)
