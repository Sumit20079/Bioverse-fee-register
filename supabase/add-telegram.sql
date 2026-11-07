-- Telegram fee reminders. Paste into Supabase -> SQL Editor -> Run (safe to run twice).

-- A private link code per student, so a parent can connect their Telegram to that student.
alter table public.students add column if not exists tg_token text;
update public.students set tg_token = replace(gen_random_uuid()::text, '-', '') where tg_token is null;
alter table public.students alter column tg_token set default replace(gen_random_uuid()::text, '-', '');
create unique index if not exists students_tg_token_idx on public.students (tg_token);

-- Which Telegram chats are connected to which student (a parent who pressed Start).
create table if not exists public.parent_chats (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  chat_id    bigint not null,
  chat_name  text not null default '',
  created_at timestamptz not null default now(),
  unique (student_id, chat_id)
);

-- When and how reminders go out (one row per teacher).
create table if not exists public.reminder_settings (
  owner_id   uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  mode       text not null default 'manual' check (mode in ('manual', 'once', 'repeat')),
  day        integer not null default 28 check (day between 1 and 31),
  every_days integer not null default 3 check (every_days between 1 and 30),
  message    text,
  updated_at timestamptz not null default now()
);

-- What was sent, so a parent isn't messaged twice in a day.
create table if not exists public.reminder_log (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  sent_at    timestamptz not null default now(),
  ok         boolean not null default true,
  detail     text not null default ''
);
create index if not exists reminder_log_student_idx on public.reminder_log (student_id, sent_at desc);

alter table public.parent_chats       enable row level security;
alter table public.reminder_settings  enable row level security;
alter table public.reminder_log       enable row level security;

drop policy if exists "own parent chats" on public.parent_chats;
drop policy if exists "own reminder settings" on public.reminder_settings;
drop policy if exists "own reminder log" on public.reminder_log;
create policy "own parent chats"      on public.parent_chats      for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own reminder settings" on public.reminder_settings for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own reminder log"      on public.reminder_log      for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
