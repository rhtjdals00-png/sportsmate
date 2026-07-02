-- Allow always-on/unscheduled regular meetings.
ALTER TABLE meetings ALTER COLUMN start_at DROP NOT NULL;
