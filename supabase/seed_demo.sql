-- Demo seed for existing users in public.users
-- Run after supabase/schema.sql

-- Ensure settings defaults exist for all users
update public.users
set settings = jsonb_build_object(
  'default_reminder_unit', coalesce(settings->>'default_reminder_unit', 'hour'),
  'preferred_channel', coalesce(settings->>'preferred_channel', 'telegram'),
  'language', coalesce(settings->>'language', 'uz')
)
where settings is null
   or settings->>'default_reminder_unit' is null
   or settings->>'preferred_channel' is null
   or settings->>'language' is null;

-- Insert sample clients for each user (if absent)
insert into public.clients (user_id, name, phone, email, telegram_chat_id, notes)
select u.id, 'Ali Valiyev', '+998901112233', 'ali.valiyev@example.com', '123456789', 'VIP client'
from public.users u
where not exists (
  select 1 from public.clients c where c.user_id = u.id and c.name = 'Ali Valiyev'
);

insert into public.clients (user_id, name, phone, email, telegram_chat_id, notes)
select u.id, 'Malika Karimova', '+998909998877', 'malika.karimova@example.com', '987654321', 'Monthly planning client'
from public.users u
where not exists (
  select 1 from public.clients c where c.user_id = u.id and c.name = 'Malika Karimova'
);

-- Insert sample meetings for each user using first available client
with first_client as (
  select distinct on (c.user_id) c.user_id, c.id as client_id
  from public.clients c
  order by c.user_id, c.created_at asc
)
insert into public.meetings (user_id, title, meeting_datetime, client_id, auto_message_enabled)
select fc.user_id, 'Weekly project sync', now() + interval '2 day', fc.client_id, true
from first_client fc
where not exists (
  select 1 from public.meetings m
  where m.user_id = fc.user_id and m.title = 'Weekly project sync'
);

with first_client as (
  select distinct on (c.user_id) c.user_id, c.id as client_id
  from public.clients c
  order by c.user_id, c.created_at asc
)
insert into public.meetings (user_id, title, meeting_datetime, client_id, auto_message_enabled)
select fc.user_id, 'Sales follow-up', now() + interval '5 day', fc.client_id, true
from first_client fc
where not exists (
  select 1 from public.meetings m
  where m.user_id = fc.user_id and m.title = 'Sales follow-up'
);

-- Insert sample reminders
insert into public.reminders (
  user_id, title, original_text, cleaned_text, parsed_data,
  frequency_value, frequency_unit, next_run_at, audio_url, status
)
select u.id,
       'Daily standup reminder',
       'har kuni ertalab 9 da standupni eslat',
       'Har kuni soat 09:00 da standup yig''ilishini eslatish.',
       '{"intent":"reminder"}'::jsonb,
       1, 'day', now() + interval '1 hour', null, 'active'
from public.users u
where not exists (
  select 1 from public.reminders r
  where r.user_id = u.id and r.title = 'Daily standup reminder'
);

-- Insert sample expenses
insert into public.expenses (user_id, amount, category, date)
select u.id, 120000, 'transport', current_date
from public.users u
where not exists (
  select 1 from public.expenses e
  where e.user_id = u.id and e.category = 'transport' and e.date = current_date
);

insert into public.expenses (user_id, amount, category, date)
select u.id, 350000, 'office', current_date - interval '1 day'
from public.users u
where not exists (
  select 1 from public.expenses e
  where e.user_id = u.id and e.category = 'office' and e.date = current_date - interval '1 day'
);

-- Insert sample notifications
insert into public.notifications (user_id, title, message, is_read)
select u.id, 'Welcome to Online Kotiba', 'System seeded successfully with demo data.', false
from public.users u
where not exists (
  select 1 from public.notifications n
  where n.user_id = u.id and n.title = 'Welcome to Online Kotiba'
);