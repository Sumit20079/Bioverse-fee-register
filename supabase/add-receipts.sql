-- Payment receipts on Telegram (already applied to the live database)
alter table public.reminder_settings add column if not exists receipts boolean not null default true;
