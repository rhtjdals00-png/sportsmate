import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "chat_mutes.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS mutes (
            user_id INTEGER,
            room_type TEXT,
            room_id INTEGER,
            PRIMARY KEY (user_id, room_type, room_id)
        )
    """)
    conn.commit()
    conn.close()

def mute_room(user_id, room_type, room_id):
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO mutes (user_id, room_type, room_id) VALUES (?, ?, ?)", (user_id, room_type, room_id))
    conn.commit()
    conn.close()

def unmute_room(user_id, room_type, room_id):
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM mutes WHERE user_id = ? AND room_type = ? AND room_id = ?", (user_id, room_type, room_id))
    conn.commit()
    conn.close()

def is_muted(user_id, room_type, room_id):
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM mutes WHERE user_id = ? AND room_type = ? AND room_id = ?", (user_id, room_type, room_id))
    row = cursor.fetchone()
    conn.close()
    return row is not None

def get_muted_rooms(user_id):
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT room_type, room_id FROM mutes WHERE user_id = ?", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [{"room_type": row[0], "room_id": row[1]} for row in rows]
