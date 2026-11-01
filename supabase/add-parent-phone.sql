-- Run once in Supabase → SQL Editor if your database was created before parent phones existed.
-- Safe to run again.
alter table public.students add column if not exists parent_phone text not null default '';
