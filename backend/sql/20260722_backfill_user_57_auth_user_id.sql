-- User 57 is a legitimate team test account whose Supabase Auth account was
-- deleted and recreated during provider testing. The team confirmed this
-- one-time relink. Back up the database before running this script.
--
-- Rehearsal: change the final COMMIT to ROLLBACK and inspect the verification
-- result first. Re-running after a successful execution is safe because the
-- UPDATE only runs when the IDs differ.
--
-- User 33 and provider_id are intentionally outside this operation's scope.

BEGIN;

DO $$
DECLARE
    target_email text;
    target_provider text;
    stored_auth_user_id text;
    current_auth_user_id text;
    matching_auth_count integer;
    conflicting_public_count integer;
BEGIN
    SELECT email, provider, auth_user_id
    INTO STRICT target_email, target_provider, stored_auth_user_id
    FROM public.users
    WHERE id = 57
    FOR UPDATE;

    IF stored_auth_user_id IS NULL THEN
        RAISE EXCEPTION 'User 57 must have a stale non-null auth_user_id';
    END IF;

    SELECT count(*), min(id::text)
    INTO matching_auth_count, current_auth_user_id
    FROM auth.users
    WHERE lower(email) = lower(target_email)
      AND email_confirmed_at IS NOT NULL
      AND raw_app_meta_data ->> 'provider' = target_provider;

    IF matching_auth_count <> 1 THEN
        RAISE EXCEPTION 'Expected one verified matching Auth user, found %', matching_auth_count;
    END IF;

    SELECT count(*)
    INTO conflicting_public_count
    FROM public.users
    WHERE auth_user_id = current_auth_user_id
      AND id <> 57;

    IF conflicting_public_count <> 0 THEN
        RAISE EXCEPTION 'Current Auth ID is already connected to another public user';
    END IF;

    UPDATE public.users
    SET auth_user_id = current_auth_user_id
    WHERE id = 57
      AND auth_user_id IS DISTINCT FROM current_auth_user_id;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = 57
          AND auth_user_id = current_auth_user_id
    ) THEN
        RAISE EXCEPTION 'User 57 Auth ID backfill verification failed';
    END IF;
END $$;

SELECT
    u.id,
    left(u.auth_user_id, 4) || '...' || right(u.auth_user_id, 4) AS stored_auth_id,
    left(a.id::text, 4) || '...' || right(a.id::text, 4) AS current_auth_id,
    u.auth_user_id = a.id::text AS backfill_verified
FROM public.users u
JOIN auth.users a
  ON lower(a.email) = lower(u.email)
 AND a.email_confirmed_at IS NOT NULL
 AND a.raw_app_meta_data ->> 'provider' = u.provider
WHERE u.id = 57;

COMMIT;
