create table public.business_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null
    check (char_length(btrim(name)) between 1 and 120),
  selling_price numeric(14, 3) not null
    check (selling_price > 0),
  materials_cost numeric(14, 3) not null default 0
    check (materials_cost >= 0),
  packaging_cost numeric(14, 3) not null default 0
    check (packaging_cost >= 0),
  other_cost numeric(14, 3) not null default 0
    check (other_cost >= 0),
  currency_code text not null
    check (currency_code in ('KWD', 'SAR', 'AED', 'BHD', 'QAR', 'OMR', 'USD')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index business_products_user_name_idx
  on public.business_products (user_id, name);

alter table public.business_products enable row level security;

grant select, insert, update, delete on public.business_products to authenticated;

create policy "Users can view their own business products"
  on public.business_products
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own business products"
  on public.business_products
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own business products"
  on public.business_products
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own business products"
  on public.business_products
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create function public.set_business_products_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger set_business_products_updated_at
  before update on public.business_products
  for each row
  execute function public.set_business_products_updated_at();
