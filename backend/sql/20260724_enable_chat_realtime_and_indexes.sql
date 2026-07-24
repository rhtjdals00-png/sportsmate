-- Chat Realtime publication and efficient delta-query indexes.
-- Run with a database owner role in the Supabase SQL editor or migration runner.

CREATE INDEX IF NOT EXISTS ix_chat_messages_room_id_id
  ON public.chat_messages (chat_room_id, id);

CREATE INDEX IF NOT EXISTS ix_direct_chat_messages_room_id_id
  ON public.direct_chat_messages (direct_chat_room_id, id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'direct_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_chat_messages;
  END IF;
END
$$;
