create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.ai_report_shares (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period text not null check (period in ('7d', '30d', '90d')),
  currency_code text not null
    check (currency_code in ('KWD', 'SAR', 'AED', 'BHD', 'QAR', 'OMR', 'USD')),
  snapshot jsonb not null
    check (pg_catalog.jsonb_typeof(snapshot) = 'object'),
  token_hash text not null
    check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint ai_report_shares_expiry_after_creation
    check (expires_at > created_at),
  constraint ai_report_shares_snapshot_context
    check (
      snapshot ->> 'period' = period
      and snapshot ->> 'currencyCode' = currency_code
    )
);

create index ai_report_shares_owner_created_idx
  on public.ai_report_shares (user_id, created_at desc);

alter table public.ai_report_shares enable row level security;
revoke all on public.ai_report_shares from public, anon, authenticated;

create or replace function public.create_ai_report_share(
  p_period text,
  p_currency_code text,
  p_snapshot jsonb,
  p_token_hash text,
  p_expires_in_days integer
)
returns table (
  share_id uuid,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_share_id uuid;
  v_created_at timestamptz := pg_catalog.now();
  v_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_period not in ('7d', '30d', '90d')
    or p_currency_code not in ('KWD', 'SAR', 'AED', 'BHD', 'QAR', 'OMR', 'USD')
    or p_expires_in_days not in (1, 7, 30)
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_snapshot is null
    or pg_catalog.jsonb_typeof(p_snapshot) <> 'object'
    or p_snapshot ->> 'period' is distinct from p_period
    or p_snapshot ->> 'currencyCode' is distinct from p_currency_code
    or pg_catalog.octet_length(p_snapshot::text) > 50000 then
    raise exception 'Invalid report share details';
  end if;

  v_share_id := pg_catalog.gen_random_uuid();
  v_expires_at := v_created_at + (p_expires_in_days * interval '1 day');

  insert into public.ai_report_shares (
    id,
    user_id,
    period,
    currency_code,
    snapshot,
    token_hash,
    created_at,
    expires_at
  ) values (
    v_share_id,
    v_user_id,
    p_period,
    p_currency_code,
    p_snapshot,
    p_token_hash,
    v_created_at,
    v_expires_at
  );

  return query select v_share_id, v_created_at, v_expires_at;
end;
$$;

create or replace function public.list_ai_report_shares()
returns table (
  share_id uuid,
  period text,
  currency_code text,
  created_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
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
    select share.id, share.period, share.currency_code, share.created_at, share.expires_at, share.revoked_at
      from public.ai_report_shares as share
      where share.user_id = v_user_id
      order by share.created_at desc
      limit 50;
end;
$$;

create or replace function public.revoke_ai_report_share(p_share_id uuid)
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

  update public.ai_report_shares as share
    set revoked_at = pg_catalog.now()
    where share.id = p_share_id
      and share.user_id = v_user_id
      and share.revoked_at is null;

  return found;
end;
$$;

create or replace function public.get_shared_ai_report(
  p_share_id uuid,
  p_token text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select share.snapshot
    from public.ai_report_shares as share
    where share.id = p_share_id
      and p_token ~ '^[A-Za-z0-9_-]{43}$'
      and share.token_hash = pg_catalog.encode(
        extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256'),
        'hex'
      )
      and share.revoked_at is null
      and share.expires_at > pg_catalog.now();
$$;

revoke all on function public.create_ai_report_share(text, text, jsonb, text, integer)
  from public, anon, authenticated;
revoke all on function public.list_ai_report_shares()
  from public, anon, authenticated;
revoke all on function public.revoke_ai_report_share(uuid)
  from public, anon, authenticated;
revoke all on function public.get_shared_ai_report(uuid, text)
  from public, anon, authenticated;

grant execute on function public.create_ai_report_share(text, text, jsonb, text, integer)
  to authenticated;
grant execute on function public.list_ai_report_shares()
  to authenticated;
grant execute on function public.revoke_ai_report_share(uuid)
  to authenticated;
grant execute on function public.get_shared_ai_report(uuid, text)
  to anon, authenticated;
