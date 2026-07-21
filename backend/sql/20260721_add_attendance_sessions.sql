BEGIN;

ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS meeting_session_id INTEGER;

UPDATE public.attendances AS attendance
SET meeting_session_id = (
  SELECT session.id
  FROM public.meeting_sessions AS session
  WHERE session.meeting_id = attendance.meeting_id
  ORDER BY session.start_at ASC, session.id ASC
  LIMIT 1
)
WHERE attendance.meeting_session_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.meeting_sessions AS session
    WHERE session.meeting_id = attendance.meeting_id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_attendances_meeting_session_id'
  ) THEN
    ALTER TABLE public.attendances
      ADD CONSTRAINT fk_attendances_meeting_session_id
      FOREIGN KEY (meeting_session_id)
      REFERENCES public.meeting_sessions(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_attendances_meeting_session_id
  ON public.attendances(meeting_session_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_session_user
  ON public.attendances(meeting_session_id, user_id)
  WHERE meeting_session_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_attendances_status'
  ) THEN
    ALTER TABLE public.attendances
      ADD CONSTRAINT ck_attendances_status
      CHECK (status IN ('present', 'absent'));
  END IF;
END $$;

UPDATE public.user_profiles
SET attendance_rate = 0;

UPDATE public.user_profiles AS profile
SET attendance_rate = attendance_stats.rate
FROM (
  SELECT
    user_id,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status = 'present')
      / NULLIF(COUNT(*) FILTER (WHERE status IN ('present', 'absent')), 0),
      1
    ) AS rate
  FROM public.attendances
  WHERE meeting_session_id IS NOT NULL
    AND status IN ('present', 'absent')
  GROUP BY user_id
) AS attendance_stats
WHERE profile.user_id = attendance_stats.user_id;

COMMIT;
