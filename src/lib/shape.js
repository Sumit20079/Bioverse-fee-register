// Turns the raw tables into what the app uses: only live rows, plus the "Recently deleted" lists.
// A batch deleted together with its students is one group (they share the same deleted_at).
export function shape(raw) {
  const liveBatches = raw.batches.filter((b) => !b.deleted_at);
  const liveBatchIds = new Set(liveBatches.map((b) => b.id));
  const students = raw.students.filter((s) => !s.deleted_at && liveBatchIds.has(s.batch_id));
  const liveIds = new Set(students.map((s) => s.id));
  const payments = raw.payments.filter((p) => liveIds.has(p.student_id));

  const payCount = new Map();
  for (const p of raw.payments) payCount.set(p.student_id, (payCount.get(p.student_id) || 0) + 1);
  const count = (list) => list.reduce((t, s) => t + (payCount.get(s.id) || 0), 0);
  const newest = (a, b) => String(b.deleted_at).localeCompare(String(a.deleted_at));

  const goneBatches = raw.batches.filter((b) => b.deleted_at);
  const inGroup = (s) => goneBatches.some((b) => b.id === s.batch_id && b.deleted_at === s.deleted_at);
  const trashBatches = goneBatches
    .map((b) => {
      const studs = raw.students.filter((s) => s.batch_id === b.id && s.deleted_at === b.deleted_at);
      return { batch: b, students: studs, paymentCount: count(studs), deleted_at: b.deleted_at };
    })
    .sort(newest);
  const batchById = new Map(raw.batches.map((b) => [b.id, b]));
  const trashStudents = raw.students
    .filter((s) => s.deleted_at && !inGroup(s))
    .map((s) => ({
      student: s,
      batchName: batchById.get(s.batch_id)?.name || '',
      batchGone: !!batchById.get(s.batch_id)?.deleted_at,
      paymentCount: payCount.get(s.id) || 0,
      deleted_at: s.deleted_at,
    }))
    .sort(newest);

  // allBatches also holds deleted ones, so months a student spent in a since-deleted batch keep that batch's fee
  return { batches: liveBatches, allBatches: raw.batches, students, payments, trash: { batches: trashBatches, students: trashStudents } };
}
