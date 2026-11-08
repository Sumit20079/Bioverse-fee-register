-- Bot round 2: parent messages (already applied to the live database)
create table if not exists public.parent_messages (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  chat_id bigint not null, chat_name text,
  direction text not null check (direction in ('in', 'out')),
  body text not null, read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists parent_messages_owner_idx on public.parent_messages (owner_id, created_at desc);
alter table public.parent_messages enable row level security;
create policy "own parent messages" on public.parent_messages for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
