create extension if not exists "uuid-ossp";

create table if not exists public.secretary_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  original_text text not null,
  cleaned_text text not null,
  parsed_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.secretary_logs enable row level security;

create policy if not exists secretary_user_all
on public.secretary_logs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
