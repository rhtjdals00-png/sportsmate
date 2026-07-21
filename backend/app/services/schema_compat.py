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

DIRECT_CHAT_MESSAGE_COLUMNS = {
    "message_type": "VARCHAR(30) NOT NULL DEFAULT 'text'",
    "attachment_url": "TEXT",
    "attachment_name": "VARCHAR(255)",
    "location_latitude": "DOUBLE PRECISION",
    "location_longitude": "DOUBLE PRECISION",
    "location_label": "VARCHAR(255)",
}


def ensure_chat_schema(app):
    try:
        inspector = inspect(db.engine)
        existing = {column["name"] for column in inspector.get_columns("chat_messages")}
        missing = [(name, column_type) for name, column_type in CHAT_MESSAGE_COLUMNS.items() if name not in existing]
        direct_existing = set()
        if inspector.has_table("direct_chat_messages"):
            direct_existing = {column["name"] for column in inspector.get_columns("direct_chat_messages")}
        direct_missing = [(name, column_type) for name, column_type in DIRECT_CHAT_MESSAGE_COLUMNS.items() if name not in direct_existing]
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
                    message_type VARCHAR(30) NOT NULL DEFAULT 'text',
                    attachment_url TEXT,
                    attachment_name VARCHAR(255),
                    location_latitude DOUBLE PRECISION,
                    location_longitude DOUBLE PRECISION,
                    location_label VARCHAR(255),
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """))
            for name, column_type in direct_missing:
                connection.execute(text(f"ALTER TABLE direct_chat_messages ADD COLUMN {name} {column_type}"))
    except Exception as error:
        app.logger.warning("Chat message schema compatibility check failed: %s", error)


SUPPORT_INQUIRY_COLUMNS = {
    "requester_email": "VARCHAR(255) NOT NULL DEFAULT ''",
    "requester_name": "VARCHAR(120) NOT NULL DEFAULT ''",
    "source": "VARCHAR(30) NOT NULL DEFAULT 'member'",
    "category": "VARCHAR(40) NOT NULL DEFAULT 'general'",
    "title": "VARCHAR(120) NOT NULL DEFAULT ''",
    "content": "TEXT NOT NULL DEFAULT ''",
    "attachment_url": "TEXT NOT NULL DEFAULT ''",
    "attachment_name": "VARCHAR(255) NOT NULL DEFAULT ''",
    "status": "VARCHAR(30) NOT NULL DEFAULT 'pending'",
    "priority": "VARCHAR(20) NOT NULL DEFAULT 'normal'",
    "admin_id": "INTEGER",
    "admin_response": "TEXT NOT NULL DEFAULT ''",
    "internal_note": "TEXT NOT NULL DEFAULT ''",
    "resolved_at": "TIMESTAMP",
    "reply_history": "TEXT NOT NULL DEFAULT '[]'",
    "created_at": "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "updated_at": "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
}


REPORT_COLUMNS = {
    "reason_detail": "TEXT NOT NULL DEFAULT ''",
    "context": "TEXT NOT NULL DEFAULT '{}'",
    "admin_id": "INTEGER",
    "admin_note": "TEXT NOT NULL DEFAULT ''",
    "resolved_at": "TIMESTAMP",
}


def ensure_report_schema(app):
    try:
        inspector = inspect(db.engine)
        with db.engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS reports (
                    id SERIAL PRIMARY KEY,
                    reporter_id INTEGER NOT NULL REFERENCES users(id),
                    target_type VARCHAR(40) NOT NULL,
                    target_id INTEGER NOT NULL,
                    reason VARCHAR(255) NOT NULL,
                    reason_detail TEXT NOT NULL DEFAULT '',
                    context TEXT NOT NULL DEFAULT '{}',
                    status VARCHAR(30) NOT NULL DEFAULT 'pending',
                    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    admin_note TEXT NOT NULL DEFAULT '',
                    resolved_at TIMESTAMP,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """))
            if inspector.has_table("reports"):
                existing = {column["name"] for column in inspector.get_columns("reports")}
                for name, column_type in REPORT_COLUMNS.items():
                    if name not in existing:
                        connection.execute(text(f"ALTER TABLE reports ADD COLUMN {name} {column_type}"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_reports_status ON reports(status)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_reports_reporter_id ON reports(reporter_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_reports_target ON reports(target_type, target_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_reports_admin_id ON reports(admin_id)"))
    except Exception as error:
        app.logger.warning("Report schema compatibility check failed: %s", error)


def ensure_support_schema(app):
    try:
        inspector = inspect(db.engine)
        with db.engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS support_inquiries (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    requester_email VARCHAR(255) NOT NULL DEFAULT '',
                    requester_name VARCHAR(120) NOT NULL DEFAULT '',
                    source VARCHAR(30) NOT NULL DEFAULT 'member',
                    category VARCHAR(40) NOT NULL DEFAULT 'general',
                    title VARCHAR(120) NOT NULL,
                    content TEXT NOT NULL,
                    attachment_url TEXT NOT NULL DEFAULT '',
                    attachment_name VARCHAR(255) NOT NULL DEFAULT '',
                    status VARCHAR(30) NOT NULL DEFAULT 'pending',
                    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
                    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    admin_response TEXT NOT NULL DEFAULT '',
                    internal_note TEXT NOT NULL DEFAULT '',
                    resolved_at TIMESTAMP,
                    reply_history TEXT NOT NULL DEFAULT '[]',
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """))
            if inspector.has_table("support_inquiries"):
                existing = {column["name"] for column in inspector.get_columns("support_inquiries")}
                for name, column_type in SUPPORT_INQUIRY_COLUMNS.items():
                    if name not in existing:
                        connection.execute(text(f"ALTER TABLE support_inquiries ADD COLUMN {name} {column_type}"))
                connection.execute(text("ALTER TABLE support_inquiries ALTER COLUMN user_id DROP NOT NULL"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_support_inquiries_user_id ON support_inquiries(user_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_support_inquiries_source ON support_inquiries(source)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_support_inquiries_admin_id ON support_inquiries(admin_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_support_inquiries_status ON support_inquiries(status)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_support_inquiries_category ON support_inquiries(category)"))
    except Exception as error:
        app.logger.warning("Support inquiry schema compatibility check failed: %s", error)


USER_WITHDRAW_COLUMNS = {
    "status": "VARCHAR(30) NOT NULL DEFAULT 'active'",
    "withdrawn_at": "TIMESTAMP",
}


def ensure_user_schema(app):
    try:
        inspector = inspect(db.engine)
        if inspector.has_table("users"):
            existing = {column["name"] for column in inspector.get_columns("users")}
            with db.engine.begin() as connection:
                for name, column_type in USER_WITHDRAW_COLUMNS.items():
                    if name not in existing:
                        connection.execute(text(f"ALTER TABLE users ADD COLUMN {name} {column_type}"))
    except Exception as error:
        app.logger.warning("User schema compatibility check failed: %s", error)


def ensure_chat_message_columns(app):
    ensure_user_schema(app)
    ensure_chat_schema(app)
    ensure_chatbot_schema(app)
    ensure_support_schema(app)
    ensure_report_schema(app)

CHATBOT_MEMORY_COLUMNS = {
    "preferred_sports": "TEXT NOT NULL DEFAULT ''",
    "preferred_regions": "TEXT NOT NULL DEFAULT ''",
    "preferred_times": "TEXT NOT NULL DEFAULT ''",
    "interest_keywords": "TEXT NOT NULL DEFAULT ''",
    "summary": "TEXT NOT NULL DEFAULT ''",
    "last_extracted_at": "TIMESTAMP",
    "created_at": "TIMESTAMP",
    "updated_at": "TIMESTAMP",
}


def ensure_chatbot_schema(app):
    try:
        inspector = inspect(db.engine)
        with db.engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS chatbot_sessions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    title VARCHAR(255) NOT NULL DEFAULT '새로운 대화',
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP
                )
            """))
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS chatbot_messages (
                    id SERIAL PRIMARY KEY,
                    session_id INTEGER NOT NULL REFERENCES chatbot_sessions(id) ON DELETE CASCADE,
                    role VARCHAR(30) NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """))
            connection.execute(text("""
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
                )
            """))
            if inspector.has_table("chatbot_user_memories"):
                existing = {column["name"] for column in inspector.get_columns("chatbot_user_memories")}
                for name, column_type in CHATBOT_MEMORY_COLUMNS.items():
                    if name not in existing:
                        connection.execute(text(f"ALTER TABLE chatbot_user_memories ADD COLUMN {name} {column_type}"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_chatbot_user_memories_user_id ON chatbot_user_memories(user_id)"))
    except Exception as error:
        app.logger.warning("Chatbot schema compatibility check failed: %s", error)
