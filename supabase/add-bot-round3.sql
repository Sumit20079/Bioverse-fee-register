-- Bot round 3: Bengali + "I've paid" claims with screenshots (already applied to the live database)
alter table public.parent_chats add column if not exists lang text not null default 'en' check (lang in ('en', 'bn'));
create table if not exists public.payment_claims (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  chat_id bigint not null, chat_name text,
  months text not null default '', amount integer not null default 0,
  proof_path text, status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists payment_claims_owner_idx on public.payment_claims (owner_id, status, created_at desc);
alter table public.payment_claims enable row level security;
create policy "own payment claims" on public.payment_claims for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
insert into storage.buckets (id, name, public) values ('payment-proofs', 'payment-proofs', false) on conflict (id) do nothing;
create policy "owner reads own proofs" on storage.objects for select to authenticated using (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
