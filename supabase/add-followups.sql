-- Step 5: follow-up ticks for applicants who asked for career counselling or the scholarship test.
alter table public.applications
  add column if not exists counselling_done boolean not null default false,
  add column if not exists scholarship_done boolean not null default false;
