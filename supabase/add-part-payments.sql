-- Run once in Supabase -> SQL Editor if your database was created before part payments existed.
-- Safe to run again. Existing payments keep counting as fully paid.

-- 1. A month can now have several payments (instalments).
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.payments'::regclass and contype = 'u'
  loop
    execute format('alter table public.payments drop constraint %I', c);
  end loop;
end $$;

-- 2. Whether the month is fully dealt with (paid in full, or the rest waived).
alter table public.payments add column if not exists settled boolean not null default true;

create index if not exists payments_student_month_idx on public.payments (student_id, month);
