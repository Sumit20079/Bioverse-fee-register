// Reading a backup file and working out what it would add. Restoring only ever ADDS rows that
// are missing (matched by id). It never changes or deletes anything that is already there.

export function parseBackup(text) {
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('This is not a backup file (it could not be read).');
  }
  if (!j || j.app !== 'bioverse-fee-register' || !Array.isArray(j.batches) || !Array.isArray(j.students) || !Array.isArray(j.payments)) {
    throw new Error('This file is not a Fee Register backup. Use a file from “Download backup”.');
  }
  // Backups made before admissions were included have no `applications` list (null = "not in this file").
  return { batches: j.batches, students: j.students, payments: j.payments, applications: Array.isArray(j.applications) ? j.applications : null, exported_at: j.exported_at };
}

// `current` is everything in the database right now, including Recently deleted.
export function planRestore(file, current) {
  const have = (rows) => new Set(rows.map((r) => r.id));
  const hb = have(current.batches);
  const hs = have(current.students);
  const hp = have(current.payments);

  const batches = file.batches.filter((b) => b.id && !hb.has(b.id));
  const allBatches = new Set([...hb, ...batches.map((b) => b.id)]);

  // A student needs its batch, a payment needs its student, or the database would refuse it.
  let skipped = 0;
  const students = [];
  for (const s of file.students) {
    if (!s.id || hs.has(s.id)) continue;
    if (allBatches.has(s.batch_id)) students.push(s);
    else skipped++;
  }
  const allStudents = new Set([...hs, ...students.map((s) => s.id)]);
  const payments = [];
  for (const p of file.payments) {
    if (!p.id || hp.has(p.id)) continue;
    if (allStudents.has(p.student_id)) payments.push(p);
    else skipped++;
  }
  // Admission applications. `current.applications` is missing when they could not be loaded (offline), so then
  // nothing is planned for them. An enrolled application whose student is gone keeps its status but loses the link.
  const haveApps = current.applications ? have(current.applications) : null;
  const applications = [];
  if (haveApps && file.applications) {
    for (const a of file.applications) {
      if (!a.id || haveApps.has(a.id)) continue;
      applications.push(a.student_id && !allStudents.has(a.student_id) ? { ...a, student_id: null } : a);
    }
  }
  return {
    batches,
    students,
    payments,
    applications,
    skipped,
    appsInFile: file.applications ? file.applications.length : null,
    appsUnchecked: !!file.applications && !haveApps,
    inFile: { batches: file.batches.length, students: file.students.length, payments: file.payments.length },
    total: batches.length + students.length + payments.length + applications.length,
  };
}
