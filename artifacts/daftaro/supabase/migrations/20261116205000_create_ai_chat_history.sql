create table public.ai_chat_histories (
  user_id uuid primary key references auth.users (id) on delete cascade,
  messages jsonb not null
    check (pg_catalog.jsonb_typeof(messages) = 'array'),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint ai_chat_histories_message_limit
    check (pg_catalog.jsonb_array_length(messages) <= 40)
);

alter table public.ai_chat_histories enable row level security;
revoke all on public.ai_chat_histories from public, anon, authenticated;

create or replace function public.get_ai_chat_history()
returns table (
  messages jsonb,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
    select coalesce(history.messages, '[]'::jsonb), history.updated_at
      from (select v_user_id as user_id) as owner
      left join public.ai_chat_histories as history on history.user_id = owner.user_id;
end;
$$;

create or replace function public.save_ai_chat_history(p_messages jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_messages jsonb;
  v_updated_at timestamptz := pg_catalog.now();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_messages is null
    or pg_catalog.jsonb_typeof(p_messages) <> 'array' then
    raise exception 'Invalid chat history';
  end if;
  if pg_catalog.jsonb_array_length(p_messages) < 1
    or pg_catalog.jsonb_array_length(p_messages) > 40 then
    raise exception 'Invalid chat history';
  end if;
  if exists (
    select 1
      from pg_catalog.jsonb_array_elements(p_messages) as entry(value)
      where pg_catalog.jsonb_typeof(entry.value) <> 'object'
        or entry.value ->> 'role' is null
        or entry.value ->> 'role' not in ('user', 'assistant')
        or pg_catalog.jsonb_typeof(entry.value -> 'content') is distinct from 'string'
        or pg_catalog.length(entry.value ->> 'content') < 1
        or pg_catalog.length(entry.value ->> 'content') > 4000
  ) then
    raise exception 'Invalid chat history';
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'role', entry.value ->> 'role',
      'content', entry.value ->> 'content'
    )
    order by entry.ordinality
  )
    into v_messages
    from pg_catalog.jsonb_array_elements(p_messages) with ordinality as entry(value, ordinality);

  insert into public.ai_chat_histories (user_id, messages, updated_at)
    values (v_user_id, v_messages, v_updated_at)
    on conflict (user_id) do update
      set messages = excluded.messages,
          updated_at = excluded.updated_at;

  return v_updated_at;
end;
$$;

create or replace function public.clear_ai_chat_history()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.ai_chat_histories as history
    where history.user_id = v_user_id;
  return found;
end;
$$;

revoke all on function public.get_ai_chat_history()
  from public, anon, authenticated;
revoke all on function public.save_ai_chat_history(jsonb)
  from public, anon, authenticated;
revoke all on function public.clear_ai_chat_history()
  from public, anon, authenticated;

grant execute on function public.get_ai_chat_history()
  to authenticated;
grant execute on function public.save_ai_chat_history(jsonb)
  to authenticated;
grant execute on function public.clear_ai_chat_history()
  to authenticated;
