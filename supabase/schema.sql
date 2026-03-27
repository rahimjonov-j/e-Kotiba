-- Enable extensions
create extension if not exists "uuid-ossp";

-- USERS
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  role text not null default 'user' check (role in ('user', 'admin')),
  settings jsonb not null default '{"default_reminder_unit":"hour","preferred_channel":"telegram","language":"uz"}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.users
  alter column settings set default '{"default_reminder_unit":"hour","preferred_channel":"telegram","language":"uz"}'::jsonb;

-- SECRETARY LOGS
create table if not exists public.secretary_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  original_text text not null,
  cleaned_text text not null,
  parsed_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- CLIENTS
create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  telegram_chat_id text,
  notes text,
  created_at timestamptz not null default now()
);

-- REMINDERS
create table if not exists public.reminders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  original_text text not null,
  cleaned_text text not null,
  parsed_data jsonb not null default '{}'::jsonb,
  frequency_value int,
  frequency_unit text check (frequency_unit in ('minute','hour','day','week','custom')),
  next_run_at timestamptz not null,
  audio_url text,
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_at timestamptz not null default now()
);

-- MEETINGS
create table if not exists public.meetings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  meeting_datetime timestamptz not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  auto_message_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- EXPENSES
create table if not exists public.expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(14,2) not null,
  category text not null,
  date date not null,
  created_at timestamptz not null default now()
);

-- NOTIFICATIONS
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  audio_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- SYSTEM JOBS
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

create index if not exists idx_reminders_user_next_run on public.reminders(user_id, next_run_at);
create index if not exists idx_meetings_user_datetime on public.meetings(user_id, meeting_datetime);
create index if not exists idx_jobs_status_scheduled on public.system_jobs(status, scheduled_for);

-- Auto-create public user record from auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- RLS
alter table public.users enable row level security;
alter table public.secretary_logs enable row level security;
alter table public.clients enable row level security;
alter table public.reminders enable row level security;
alter table public.meetings enable row level security;
alter table public.expenses enable row level security;
alter table public.notifications enable row level security;
alter table public.system_jobs enable row level security;

-- User self-access
create policy if not exists users_self_select on public.users for select using (auth.uid() = id);
create policy if not exists users_self_update on public.users for update using (auth.uid() = id);

create policy if not exists secretary_user_all on public.secretary_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists clients_user_all on public.clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists reminders_user_all on public.reminders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists meetings_user_all on public.meetings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists expenses_user_all on public.expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists notifications_user_all on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admin-only policies
create policy if not exists admin_users_view_all on public.users for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

create policy if not exists admin_jobs_all on public.system_jobs for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
) with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

-- Storage bucket setup note:
-- create bucket `reminder-audio` in Supabase Storage and allow authenticated read if needed.
