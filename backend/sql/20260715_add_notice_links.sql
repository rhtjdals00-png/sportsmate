ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS notice_type varchar(20) NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS vote_id integer REFERENCES public.votes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_id integer REFERENCES public.meeting_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_notices_vote_id ON public.notices(vote_id);
CREATE INDEX IF NOT EXISTS ix_notices_session_id ON public.notices(session_id);
