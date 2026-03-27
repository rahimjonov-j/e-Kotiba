create extension if not exists "uuid-ossp";

create table if not exists public.system_jobs (
  id uuid primary key default uuid_generate_v4(),
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  retry_count int not null default 0,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_jobs_status_scheduled on public.system_jobs(status, scheduled_for);

alter table public.system_jobs enable row level security;

drop policy if exists admin_jobs_all on public.system_jobs;
create policy admin_jobs_all on public.system_jobs
for all
using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
)
with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);