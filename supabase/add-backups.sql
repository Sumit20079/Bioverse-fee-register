-- Private storage for the nightly backups (api/backup.js). No policies on purpose:
-- only the server (service key) can read or write here; the app and the public cannot.
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;
