-- Remembers which batch each student was in, month by month, so moving a student
-- doesn't change their old months. Paste into Supabase -> SQL Editor -> Run (safe to run twice).
alter table public.students add column if not exists batch_history jsonb;
