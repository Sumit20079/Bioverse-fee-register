import { monthsBetween } from './dates';

// Everything the Overview / Batch screens need for one month.
// A payment row means "this month is settled", at whatever amount was received.
export function monthView(data, month) {
  const paid = new Map(data.payments.map((p) => [`${p.student_id}|${p.month}`, p]));

  const batches = data.batches.map((batch) => {
    const rows = [];
    for (const student of data.students) {
      if (student.batch_id !== batch.id) continue;
      const payment = paid.get(`${student.id}|${month}`) || null;
      const enrolled = student.active && student.joined_month <= month;
      if (!enrolled && !payment) continue;
      rows.push({ student, payment });
    }
    rows.sort((a, b) => a.student.name.localeCompare(b.student.name));

    const dueCount = rows.filter((r) => !r.payment).length;
    return {
      batch,
      rows,
      total: rows.length,
      paidCount: rows.length - dueCount,
      dueCount,
      collected: rows.reduce((t, r) => t + (r.payment ? r.payment.amount : 0), 0),
      pending: dueCount * batch.fee,
    };
  });

  const sum = (key) => batches.reduce((t, b) => t + b[key], 0);
  const collected = sum('collected');
  const pending = sum('pending');
  return {
    batches,
    collected,
    pending,
    expected: collected + pending,
    paidCount: sum('paidCount'),
    dueCount: sum('dueCount'),
  };
}

// Active students who owe one or more months up to and including `month`.
export function dueList(data, month) {
  const paid = new Set(data.payments.map((p) => `${p.student_id}|${p.month}`));
  const batchById = new Map(data.batches.map((b) => [b.id, b]));
  const out = [];

  for (const student of data.students) {
    if (!student.active) continue;
    const batch = batchById.get(student.batch_id);
    if (!batch) continue;
    const months = monthsBetween(student.joined_month, month).filter((m) => !paid.has(`${student.id}|${m}`));
    if (!months.length) continue;
    out.push({ student, batch, months, amount: months.length * batch.fee });
  }

  out.sort(
    (a, b) =>
      a.months[0].localeCompare(b.months[0]) ||
      b.amount - a.amount ||
      a.student.name.localeCompare(b.student.name),
  );
  return out;
}
