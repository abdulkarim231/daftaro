create table public.business_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business_name text not null
    check (char_length(btrim(business_name)) between 1 and 120),
  business_type text
    check (business_type is null or char_length(business_type) <= 100),
  country_code text not null default 'KW'
    check (country_code in ('KW', 'SA', 'AE', 'BH', 'QA', 'OM', 'OTHER')),
  currency_code text not null default 'KWD'
    check (currency_code in ('KWD', 'SAR', 'AED', 'BHD', 'QAR', 'OMR', 'USD')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_profiles enable row level security;

grant select, insert, update on public.business_profiles to authenticated;

create policy "Users can view their own business profile"
  on public.business_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own business profile"
  on public.business_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own business profile"
  on public.business_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.set_business_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_business_profiles_updated_at
  before update on public.business_profiles
  for each row
  execute function public.set_business_profiles_updated_at();
