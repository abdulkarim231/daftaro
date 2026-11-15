create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_type text not null
    check (transaction_type in ('income', 'expense')),
  amount numeric(14, 3) not null
    check (amount > 0),
  currency_code text not null
    check (currency_code in ('KWD', 'SAR', 'AED', 'BHD', 'QAR', 'OMR', 'USD')),
  transaction_date date not null default current_date,
  description text not null
    check (char_length(btrim(description)) between 1 and 250),
  category text
    check (category is null or char_length(category) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_transactions_expense_category_required
    check (
      transaction_type = 'income'
      or nullif(btrim(category), '') is not null
    )
);

create index financial_transactions_user_date_idx
  on public.financial_transactions (user_id, transaction_date desc, created_at desc);

alter table public.financial_transactions enable row level security;

grant select, insert, update, delete on public.financial_transactions to authenticated;

create policy "Users can view their own financial transactions"
  on public.financial_transactions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own financial transactions"
  on public.financial_transactions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own financial transactions"
  on public.financial_transactions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own financial transactions"
  on public.financial_transactions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create function public.set_financial_transactions_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger set_financial_transactions_updated_at
  before update on public.financial_transactions
  for each row
  execute function public.set_financial_transactions_updated_at();
