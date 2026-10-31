-- Fee Register schema. Paste this whole file into Supabase → SQL Editor → Run.

create table public.batches (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  fee        integer not null check (fee >= 0),
  created_at timestamptz not null default now()
);

create table public.students (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  batch_id     uuid not null references public.batches (id) on delete restrict,
  name         text not null,
  phone        text not null default '',
  joined_month date not null check (joined_month = date_trunc('month', joined_month)::date),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  month      date not null check (month = date_trunc('month', month)::date),
  amount     integer not null check (amount >= 0),
  paid_on    date not null default current_date,
  note       text not null default '',
  created_at timestamptz not null default now(),
  unique (student_id, month)
);

create index students_batch_idx on public.students (batch_id);
create index payments_month_idx on public.payments (month);

-- Each logged-in teacher can only see and change their own rows.
alter table public.batches  enable row level security;
alter table public.students enable row level security;
alter table public.payments enable row level security;

create policy "own batches"  on public.batches  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own students" on public.students for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own payments" on public.payments for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
