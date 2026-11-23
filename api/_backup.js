// Pure helpers for the nightly backup (kept apart from the network code so they can be tested).

export const KEEP_DAYS = 30;
export const backupName = (date) => `fee-register-backup-${date}.json`;

// The same shape as Settings → Download backup, so Restore from backup reads it as it is.
export function buildBackup({ batches, students, payments, applications }, now = new Date()) {
  return { app: 'bioverse-fee-register', version: 2, exported_at: now.toISOString(), automatic: true, batches, students, payments, applications };
}

export const summaryLine = (b) => `${b.students.length} students, ${b.payments.length} payments, ${b.applications.length} applications`;

// Which stored files are older than `keep` days (by the date in their name). Anything that isn't one of ours is left alone.
export function expiredNames(names, today, keep = KEEP_DAYS) {
  const cutoff = new Date(`${today}T00:00:00Z`).getTime() - keep * 86400000;
  return names.filter((n) => {
    const m = /^fee-register-backup-(\d{4}-\d{2}-\d{2})\.json$/.exec(n);
    return m && new Date(`${m[1]}T00:00:00Z`).getTime() < cutoff;
  });
}
