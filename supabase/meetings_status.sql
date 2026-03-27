alter table public.meetings
  add column if not exists status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  add column if not exists cancelled_at timestamptz null;

create index if not exists idx_meetings_user_status_datetime
  on public.meetings(user_id, status, meeting_datetime);
