create table public.daftaro_connection_test (
  id uuid primary key default gen_random_uuid(),
  message text not null check (message = 'Daftaro Supabase connection test'),
  created_at timestamptz not null default now()
);

alter table public.daftaro_connection_test enable row level security;

grant select on public.daftaro_connection_test to anon;

create policy "Anon can read the fixed Daftaro test row"
  on public.daftaro_connection_test
  for select
  to anon
  using (message = 'Daftaro Supabase connection test');
