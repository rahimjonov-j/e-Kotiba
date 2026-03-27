create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  password_hash text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  default_reminder_unit text not null default 'hour' check (default_reminder_unit in ('minute', 'hour', 'day', 'week', 'custom')),
  reminder_interval text not null default '1min' check (reminder_interval in ('1min', '5min', '15min', '1hour')),
  preferred_channel text not null default 'in_app' check (preferred_channel in ('in_app')),
  language text not null default 'uz' check (language in ('uz', 'en', 'ru')),
  timezone text not null default 'Asia/Tashkent',
  theme text not null default 'light' check (theme in ('light', 'dark', 'system')),
  audio_enabled boolean not null default true,
  monthly_salary numeric(12,2) not null default 0 check (monthly_salary >= 0),
  tts_voice text not null default 'lola',
  welcome_seen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.user_settings
  add column if not exists monthly_salary numeric(12,2) not null default 0;

alter table if exists public.user_settings
  add column if not exists tts_voice text not null default 'lola';

alter table if exists public.user_settings
  add column if not exists welcome_seen boolean not null default false;

create table if not exists public.secretary_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  original_text text not null,
  cleaned_text text not null,
  parsed_data jsonb not null default '{}'::jsonb,
  audio_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  telegram_chat_id text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  intent text not null check (intent in ('reminder', 'meeting', 'task', 'expense')),
  date date,
  time text,
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  source_text text,
  normalized_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  original_text text not null,
  cleaned_text text not null,
  parsed_data jsonb not null default '{}'::jsonb,
  frequency_value int,
  frequency_unit text check (frequency_unit in ('minute', 'hour', 'day', 'week', 'custom')),
  next_run_at timestamptz not null,
  audio_url text,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  meeting_datetime timestamptz not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  auto_message_enabled boolean not null default true,
  reminder_interval text default '1min',
  enable_audio_reminder boolean not null default true,
  last_triggered_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(14, 2) not null,
  original_amount numeric(14, 2),
  currency text not null default 'UZS',
  exchange_rate numeric(18, 6),
  exchange_rate_date text,
  category text not null,
  date date not null,
  title text,
  spent_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

alter table if exists public.expenses
  add column if not exists original_amount numeric(14, 2);

alter table if exists public.expenses
  add column if not exists currency text not null default 'UZS';

alter table if exists public.expenses
  add column if not exists exchange_rate numeric(18, 6);

alter table if exists public.expenses
  add column if not exists exchange_rate_date text;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  title text not null,
  message text not null,
  body text,
  audio_url text,
  scheduled_for timestamptz,
  triggered_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'read')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.system_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  retry_count int not null default 0,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_token on public.sessions(token);
create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_reminders_user_next_run on public.reminders(user_id, next_run_at);
create index if not exists idx_meetings_user_datetime on public.meetings(user_id, meeting_datetime);
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_jobs_status_scheduled on public.system_jobs(status, scheduled_for);
create index if not exists idx_tasks_user_created on public.tasks(user_id, created_at desc);
create index if not exists idx_expenses_user_date on public.expenses(user_id, date desc);
