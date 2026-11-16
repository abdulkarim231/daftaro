create table public.ai_saved_reports (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period text not null check (period in ('7d', '30d', '90d')),
  currency_code text not null
    check (currency_code in ('KWD', 'SAR', 'AED', 'BHD', 'QAR', 'OMR', 'USD')),
  snapshot jsonb not null
    check (pg_catalog.jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default pg_catalog.now(),
  constraint ai_saved_reports_snapshot_context
    check (
      snapshot ->> 'period' is not distinct from period
      and snapshot ->> 'currencyCode' is not distinct from currency_code
    ),
  constraint ai_saved_reports_snapshot_size
    check (pg_catalog.octet_length(snapshot::text) <= 50000)
);

create index ai_saved_reports_owner_created_idx
  on public.ai_saved_reports (user_id, created_at desc, id desc);

alter table public.ai_saved_reports enable row level security;
revoke all on public.ai_saved_reports from public, anon, authenticated;

create or replace function public.create_ai_saved_report(
  p_period text,
  p_currency_code text,
  p_snapshot jsonb
)
returns table (
  saved_report_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_report_id uuid;
  v_created_at timestamptz := pg_catalog.now();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_period not in ('7d', '30d', '90d')
    or p_currency_code not in ('KWD', 'SAR', 'AED', 'BHD', 'QAR', 'OMR', 'USD')
    or p_snapshot is null
    or pg_catalog.jsonb_typeof(p_snapshot) <> 'object'
    or p_snapshot ->> 'period' is distinct from p_period
    or p_snapshot ->> 'currencyCode' is distinct from p_currency_code
    or pg_catalog.octet_length(p_snapshot::text) > 50000 then
    raise exception 'Invalid saved report details';
  end if;

  v_report_id := pg_catalog.gen_random_uuid();
  insert into public.ai_saved_reports (
    id,
    user_id,
    period,
    currency_code,
    snapshot,
    created_at
  ) values (
    v_report_id,
    v_user_id,
    p_period,
    p_currency_code,
    p_snapshot,
    v_created_at
  );

  return query select v_report_id, v_created_at;
end;
$$;

create or replace function public.list_ai_saved_reports(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  saved_report_id uuid,
  period text,
  currency_code text,
  created_at timestamptz
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
  if p_limit is null or p_limit < 1 or p_limit > 50 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid saved report page';
  end if;

  return query
    select report.id, report.period, report.currency_code, report.created_at
      from public.ai_saved_reports as report
      where report.user_id = v_user_id
      order by report.created_at desc, report.id desc
      limit p_limit
      offset p_offset;
end;
$$;

create or replace function public.get_ai_saved_report(p_saved_report_id uuid)
returns table (
  saved_report_id uuid,
  period text,
  currency_code text,
  created_at timestamptz,
  snapshot jsonb
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
    select report.id, report.period, report.currency_code, report.created_at, report.snapshot
      from public.ai_saved_reports as report
      where report.id = p_saved_report_id
        and report.user_id = v_user_id;
end;
$$;

create or replace function public.delete_ai_saved_report(p_saved_report_id uuid)
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

  delete from public.ai_saved_reports as report
    where report.id = p_saved_report_id
      and report.user_id = v_user_id;
  return found;
end;
$$;

revoke all on function public.create_ai_saved_report(text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.list_ai_saved_reports(integer, integer)
  from public, anon, authenticated;
revoke all on function public.get_ai_saved_report(uuid)
  from public, anon, authenticated;
revoke all on function public.delete_ai_saved_report(uuid)
  from public, anon, authenticated;

grant execute on function public.create_ai_saved_report(text, text, jsonb)
  to authenticated;
grant execute on function public.list_ai_saved_reports(integer, integer)
  to authenticated;
grant execute on function public.get_ai_saved_report(uuid)
  to authenticated;
grant execute on function public.delete_ai_saved_report(uuid)
  to authenticated;
