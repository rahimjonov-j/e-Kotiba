alter table public.meetings
  add column if not exists reminder_interval text,
  add column if not exists enable_audio_reminder boolean not null default false,
  add column if not exists last_triggered_at timestamptz;

create index if not exists idx_meetings_audio_reminder on public.meetings(enable_audio_reminder, meeting_datetime);