-- Allow Supabase Realtime to deliver chat rows only to users who can access
-- the corresponding meeting or direct-message room.

CREATE OR REPLACE FUNCTION public.can_access_meeting_chat_room(
  target_room_id bigint,
  target_auth_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_rooms AS room
    JOIN public.meetings AS meeting
      ON meeting.id = room.meeting_id
    JOIN public.users AS app_user
      ON app_user.auth_user_id = target_auth_user_id::text
    WHERE room.id = target_room_id
      AND (
        meeting.host_id = app_user.id
        OR EXISTS (
          SELECT 1
          FROM public.participants AS participant
          WHERE participant.meeting_id = meeting.id
            AND participant.user_id = app_user.id
            AND participant.status = 'approved'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_direct_chat_room(
  target_room_id bigint,
  target_auth_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.direct_chat_rooms AS room
    JOIN public.users AS app_user
      ON app_user.auth_user_id = target_auth_user_id::text
    WHERE room.id = target_room_id
      AND app_user.id IN (room.user_a_id, room.user_b_id)
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_meeting_chat_room(bigint, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_direct_chat_room(bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_meeting_chat_room(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_direct_chat_room(bigint, uuid) TO authenticated;

DROP POLICY IF EXISTS chat_messages_realtime_select ON public.chat_messages;
CREATE POLICY chat_messages_realtime_select
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_meeting_chat_room(chat_room_id, auth.uid())
  );

DROP POLICY IF EXISTS direct_chat_messages_realtime_select ON public.direct_chat_messages;
CREATE POLICY direct_chat_messages_realtime_select
  ON public.direct_chat_messages
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_direct_chat_room(direct_chat_room_id, auth.uid())
  );
