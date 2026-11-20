-- Admissions: applications from the public Bio-Verse form.
-- Run once in Supabase -> SQL Editor. Safe to run again.
-- Nothing in batches, students or payments is changed.

-- 1. Admission ID counter (BV26-0001, restarts each year)
create table if not exists public.admission_counters (
  year int primary key,
  last int not null default 0
);
alter table public.admission_counters enable row level security; -- no policies: only submit_application() touches it

-- 2. Applications
create table if not exists public.applications (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  admission_id  text not null unique,

  -- student
  student_name  text not null,
  gender        text not null check (gender in ('Male','Female','Other')),
  class         text not null check (class in ('5','6','7','8','9','10','11','12','Dropper','11+NEET','12+NEET')),
  school        text not null,
  board         text not null check (board in ('ICSE','CBSE','WBBSE','WBCHSE','Other')),
  student_phone text not null check (student_phone ~ '^[0-9]{10}$'),
  student_email text not null,
  address       text not null,
  blood_group   text check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  hobby         text,

  -- parents (at least one name; the main contact must have a number)
  father_name       text,
  father_phone      text check (father_phone ~ '^[0-9]{10}$'),
  father_profession text,
  mother_name       text,
  mother_phone      text check (mother_phone ~ '^[0-9]{10}$'),
  mother_profession text,
  main_contact      text not null check (main_contact in ('father','mother')),

  -- academics: percentage is stored as obtained out of 100; NEET marks as obtained out of 720
  result_obtained numeric(7,2) not null check (result_obtained >= 0),
  result_total    numeric(7,2) not null check (result_total > 0),
  result_percent  numeric(5,2) generated always as (round(result_obtained / result_total * 100, 2)) stored,
  marksheet_path  text,

  -- preferences
  careers            text[] not null,
  career_other       text,
  batch_location     text not null check (batch_location in ('Habra','Jaguli','Haringhata','Gobardanga','Nahata')),
  result_expectation text,
  referred_from      text not null check (referred_from in ('Teacher','Student','Friend','Senior','Social media','Other')),
  wants_counselling  boolean not null,
  wants_scholarship  boolean not null,
  consent            boolean not null check (consent),

  -- teacher side
  status     text not null default 'new' check (status in ('new','counselled','enrolled','dropped')),
  notes      text not null default '',
  student_id uuid references public.students (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),

  check (result_obtained <= result_total),
  check (father_name is not null or mother_name is not null),
  check ((main_contact = 'father' and father_phone is not null) or (main_contact = 'mother' and mother_phone is not null))
);

create index if not exists applications_phone_idx   on public.applications (student_phone);
create index if not exists applications_owner_idx   on public.applications (owner_id, status, created_at desc);

-- Same rule as every other table: only the teacher's login can see or change rows.
alter table public.applications enable row level security;
drop policy if exists "own applications" on public.applications;
create policy "own applications" on public.applications for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 3. The ONLY way the public form can write: this function. It never reads anything back except the new admission ID.
create or replace function public.submit_application(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_year  int := extract(year from (now() at time zone 'Asia/Kolkata'))::int;
  v_n     int;
  v_id    text;
  v_path  text := nullif(p->>'marksheet_path', '');
begin
  -- invisible spam checks: the hidden field must stay empty, and a human takes more than 4 seconds
  if coalesce(p->>'website', '') <> '' then raise exception 'rejected'; end if;
  if coalesce((p->>'elapsed_ms')::int, 0) < 4000 then raise exception 'too fast'; end if;

  -- marksheet is required from class 10 up (and for Droppers / NEET batches)
  if (p->>'class') in ('10','11','12','Dropper','11+NEET','12+NEET') and v_path is null then
    raise exception 'marksheet required';
  end if;
  if v_path is not null and v_path !~ '^incoming/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$' then
    raise exception 'bad file path';
  end if;

  -- applications belong to the teacher account that owns the batches
  select owner_id into v_owner from public.batches order by created_at limit 1;
  if v_owner is null then raise exception 'not set up'; end if;

  insert into public.admission_counters (year, last) values (v_year, 1)
    on conflict (year) do update set last = public.admission_counters.last + 1
    returning last into v_n;
  v_id := 'BV' || lpad((v_year % 100)::text, 2, '0') || '-' || lpad(v_n::text, 4, '0');

  insert into public.applications (
    owner_id, admission_id,
    student_name, gender, class, school, board, student_phone, student_email, address, blood_group, hobby,
    father_name, father_phone, father_profession, mother_name, mother_phone, mother_profession, main_contact,
    result_obtained, result_total, marksheet_path,
    careers, career_other, batch_location, result_expectation, referred_from,
    wants_counselling, wants_scholarship, consent
  ) values (
    v_owner, v_id,
    trim(p->>'student_name'), p->>'gender', p->>'class', trim(p->>'school'), p->>'board', p->>'student_phone',
    trim(p->>'student_email'), trim(p->>'address'), nullif(p->>'blood_group', ''), nullif(trim(p->>'hobby'), ''),
    nullif(trim(p->>'father_name'), ''), nullif(p->>'father_phone', ''), nullif(trim(p->>'father_profession'), ''),
    nullif(trim(p->>'mother_name'), ''), nullif(p->>'mother_phone', ''), nullif(trim(p->>'mother_profession'), ''),
    p->>'main_contact',
    (p->>'result_obtained')::numeric, (p->>'result_total')::numeric, v_path,
    array(select jsonb_array_elements_text(p->'careers')), nullif(trim(p->>'career_other'), ''),
    p->>'batch_location', nullif(trim(p->>'result_expectation'), ''), p->>'referred_from',
    (p->>'wants_counselling')::boolean, (p->>'wants_scholarship')::boolean, (p->>'consent')::boolean
  );
  return v_id;
end $$;

revoke all on function public.submit_application(jsonb) from public;
grant execute on function public.submit_application(jsonb) to anon;

-- 4. School names already used, so the form can suggest them (names only, nothing else)
create or replace function public.school_suggestions() returns setof text
language sql stable security definer set search_path = public as $$
  select distinct school from public.applications where deleted_at is null order by 1 limit 500;
$$;
revoke all on function public.school_suggestions() from public;
grant execute on function public.school_suggestions() to anon;

-- 5. Private folder for marksheets: the public form can add files, only the teacher can open or delete them
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marksheets', 'marksheets', false, 5242880, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

drop policy if exists "form uploads marksheets" on storage.objects;
drop policy if exists "teacher reads marksheets" on storage.objects;
drop policy if exists "teacher deletes marksheets" on storage.objects;
create policy "form uploads marksheets" on storage.objects for insert to anon
  with check (bucket_id = 'marksheets' and name like 'incoming/%');
create policy "teacher reads marksheets" on storage.objects for select to authenticated
  using (bucket_id = 'marksheets');
create policy "teacher deletes marksheets" on storage.objects for delete to authenticated
  using (bucket_id = 'marksheets');

-- 6. Tighten access: the public form only ever uses the two functions, never the tables directly
revoke all on public.applications from anon;
revoke all on public.admission_counters from anon;
revoke all on public.admission_counters from authenticated;
revoke execute on function public.submit_application(jsonb) from authenticated;
