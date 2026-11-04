-- Fee history: lets a batch's fee change from a chosen month without rewriting earlier months.
-- Run once in the Supabase SQL editor BEFORE the app update that uses it.
alter table public.batches add column if not exists fee_history jsonb;
