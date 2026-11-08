-- Exam marks (already applied to the live database)
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  batch_id uuid not null references public.batches (id) on delete cascade,
  name text not null, total numeric not null check (total > 0),
  held_on date not null default current_date, created_at timestamptz not null default now()
);
create table if not exists public.exam_marks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exam_id uuid not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  score numeric check (score >= 0), absent boolean not null default false,
  sent_score numeric, sent_at timestamptz, unique (exam_id, student_id)
);
create index if not exists exams_batch_idx on public.exams (owner_id, batch_id, held_on desc);
create index if not exists exam_marks_exam_idx on public.exam_marks (exam_id);
alter table public.exams enable row level security;
alter table public.exam_marks enable row level security;
create policy "own exams" on public.exams for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own exam marks" on public.exam_marks for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
alter table public.reminder_settings add column if not exists results_auto boolean not null default false;
