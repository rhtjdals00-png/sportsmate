-- Add suspended_at column to meetings table for deactivation grace period
ALTER TABLE meetings ADD COLUMN suspended_at TIMESTAMP WITHOUT TIME ZONE;
