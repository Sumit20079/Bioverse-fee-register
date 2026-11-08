-- Bot round 1: heads-up, teacher updates (already applied to the live database)
alter table public.reminder_settings
  add column if not exists warn_days integer not null default 0 check (warn_days between 0 and 10),
  add column if not exists summary boolean not null default false,
  add column if not exists notify_connect boolean not null default true,
  add column if not exists teacher_chat_id bigint,
  add column if not exists teacher_token text default replace(gen_random_uuid()::text, '-', '');
create unique index if not exists reminder_settings_teacher_token_idx on public.reminder_settings (teacher_token);
