alter table public.users
  add column if not exists user_tag varchar(4);

create or replace function public.generate_user_tag()
returns varchar(4)
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  candidate varchar(4);
begin
  loop
    candidate := '';
    for i in 1..4 loop
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    end loop;

    exit when not exists (
      select 1
      from public.users
      where user_tag = candidate
    );
  end loop;

  return candidate;
end;
$$;

update public.users
set user_tag = public.generate_user_tag()
where user_tag is null or btrim(user_tag) = '';

alter table public.users
  alter column user_tag set not null;

do $$
declare
  constraint_record record;
  index_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint constraint_table
    join pg_attribute attribute_table
      on attribute_table.attrelid = constraint_table.conrelid
     and attribute_table.attnum = any(constraint_table.conkey)
    where constraint_table.conrelid = 'public.users'::regclass
      and constraint_table.contype = 'u'
      and attribute_table.attname = 'nickname'
  loop
    execute format('alter table public.users drop constraint %I', constraint_record.conname);
  end loop;

  for index_record in
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'users'
      and indexdef ilike '%unique%'
      and indexdef ilike '%nickname%'
  loop
    execute format('drop index if exists public.%I', index_record.indexname);
  end loop;
end $$;

create unique index if not exists ix_users_user_tag
  on public.users (user_tag);

create index if not exists ix_users_nickname
  on public.users (nickname);
