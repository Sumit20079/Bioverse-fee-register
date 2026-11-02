-- Run once in Supabase -> SQL Editor. Safe to run again.
-- Deleting a student or batch now moves it to "Recently deleted" instead of erasing it.
-- Run this BEFORE the matching app update goes live.

alter table public.students add column if not exists deleted_at timestamptz;
alter table public.batches  add column if not exists deleted_at timestamptz;
