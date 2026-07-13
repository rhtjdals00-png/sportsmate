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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE support_inquiries ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE support_inquiries ADD COLUMN IF NOT EXISTS requester_email VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE support_inquiries ADD COLUMN IF NOT EXISTS requester_name VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE support_inquiries ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'member';
ALTER TABLE support_inquiries ADD COLUMN IF NOT EXISTS attachment_url TEXT NOT NULL DEFAULT '';
ALTER TABLE support_inquiries ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS ix_support_inquiries_user_id ON support_inquiries(user_id);
CREATE INDEX IF NOT EXISTS ix_support_inquiries_source ON support_inquiries(source);
CREATE INDEX IF NOT EXISTS ix_support_inquiries_admin_id ON support_inquiries(admin_id);
CREATE INDEX IF NOT EXISTS ix_support_inquiries_status ON support_inquiries(status);
CREATE INDEX IF NOT EXISTS ix_support_inquiries_category ON support_inquiries(category);
