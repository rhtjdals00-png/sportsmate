ALTER TABLE public.votes
  ADD COLUMN IF NOT EXISTS ends_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS allow_multiple boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT true;
