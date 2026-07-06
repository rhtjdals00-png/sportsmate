ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS profile_intro_dismissed boolean NOT NULL DEFAULT false;

ALTER TABLE public.users
DROP COLUMN IF EXISTS profile_intro_snoozed_until;
