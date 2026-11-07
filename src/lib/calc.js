import { monthsBetween } from './dates.js';

// A batch's fee for a given month. `fee_history` lists the changes ({from:'YYYY-MM', fee}, oldest first);
// the first entry is the original fee and applies to every earlier month. Without history, the batch fee applies always.
export function feeFor(batch, month) {
  const h = batch.fee_history;
  if (!Array.isArray(h) || !h.length) return batch.fee;
  let fee = h[0].fee;
  for (const e of h) if (e.from <= month) fee = e.fee;
  return fee;
}

// The batch row to save when its fee changes, starting from `from` (earlier months keep their fee).
export function withFeeChange(batch, fee, from) {
  const base = Array.isArray(batch.fee_history) && batch.fee_history.length ? batch.fee_history : [{ from: '0000-00', fee: batch.fee }];
  const kept = base.filter((e) => e.from < from);
  return { fee, fee_history: [...kept, { from, fee }] };
}

// Which batch a student was in during `month`. `batch_history` lists the moves ({from:'YYYY-MM', batch_id}, oldest first);
// the first entry is where they started and applies to every earlier month. Without history, their current batch.
// `known` (a Set of batch ids still in use) makes a batch that has since been deleted fall back to the current one.
export function batchAt(student, month, known) {
  const h = student.batch_history;
  if (!Array.isArray(h) || !h.length) return student.batch_id;
  let id = h[0].batch_id;
  for (const e of h) if (e.from <= month) id = e.batch_id;
  return known && !known.has(id) ? student.batch_id : id;
}

// The fee a student owed for `month`: the fee of the batch they were in then.
export function feeOn(student, batches, month) {
  const known = new Set(batches.map((b) => b.id));
  const b = batches.find((x) => x.id === batchAt(student, month, known)) || batches.find((x) => x.id === student.batch_id);
  return b ? feeFor(b, month) : 0;
}

// The student row to save when they move to `batchId` from `from` (earlier months stay where they were).
// `thisMonth` decides which batch counts as their current one.
export function withBatchMove(student, batchId, from, thisMonth) {
  const base = Array.isArray(student.batch_history) && student.batch_history.length ? student.batch_history : [{ from: '0000-00', batch_id: student.batch_id }];
  const history = [...base.filter((e) => e.from < from), { from, batch_id: batchId }];
  return { batch_id: batchAt({ batch_history: history, batch_id: batchId }, thisMonth), batch_history: history };
}

const sum = (rows) => rows.reduce((t, p) => t + p.amount, 0);

// Where one student's month stands, given that month's payments (there may be several instalments).
// A month is settled once the instalments reach the fee, or the rest was waived (a discount).
// Payments saved before part payments existed carry no flag and count as settled.
export function monthStatus(rows, fee) {
  const received = sum(rows);
  const settled = rows.some((r) => r.settled !== false) || received >= fee;
  const last = rows.reduce((a, r) => (!a || (r.paid_on || '') >= (a.paid_on || '') ? r : a), null);
  return {
    rows,
    received,
    settled,
    balance: settled ? 0 : Math.max(0, fee - received),
    status: !rows.length ? 'due' : settled ? 'paid' : 'part',
    last,
  };
}

// A "settled" flag set because instalments reached the fee goes stale when an instalment is later edited or
// removed. Given the month's rows before and after such a change, returns the rows that must be un-settled:
// the month was full by payments before, and is short now. (A waiver leaves the month short already, so it stays.)
export function staleSettled(before, after, fee) {
  if (sum(before) < fee || sum(after) >= fee) return [];
  return after.filter((r) => r.settled !== false);
}

function groupPayments(payments) {
  const by = new Map();
  for (const p of payments) {
    const k = `${p.student_id}|${p.month}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(p);
  }
  return by;
}

// Everything the Overview / Batch screens need for one month.
export function monthView(data, month) {
  const by = groupPayments(data.payments);
  const known = new Set(data.batches.map((b) => b.id));

  const batches = data.batches.map((batch) => {
    const rows = [];
    for (const student of data.students) {
      if (batchAt(student, month, known) !== batch.id) continue;
      const list = by.get(`${student.id}|${month}`) || [];
      const enrolled = student.active && student.joined_month <= month;
      if (!enrolled && !list.length) continue;
      const ms = monthStatus(list, feeFor(batch, month));
      const owes = enrolled && !ms.settled;
      rows.push({
        student,
        // one combined payment for the month (null when nothing was received)
        payment: ms.last
          ? { ...ms.last, amount: ms.received, note: [...list].reverse().find((r) => r.note)?.note || '' }
          : null,
        payments: list,
        received: ms.received,
        settled: ms.settled,
        owes,
        balance: owes ? ms.balance : 0,
        status: ms.status,
      });
    }
    rows.sort((a, b) => a.student.name.localeCompare(b.student.name));

    const dueCount = rows.filter((r) => r.owes).length;
    return {
      batch,
      rows,
      total: rows.length,
      paidCount: rows.length - dueCount,
      dueCount,
      collected: rows.reduce((t, r) => t + r.received, 0),
      pending: rows.reduce((t, r) => t + r.balance, 0),
    };
  });

  const total = (key) => batches.reduce((t, b) => t + b[key], 0);
  const collected = total('collected');
  const pending = total('pending');
  return {
    batches,
    collected,
    pending,
    expected: collected + pending,
    paidCount: total('paidCount'),
    dueCount: total('dueCount'),
  };
}

// Active students who still owe something for one or more months up to and including `month`.
export function dueList(data, month) {
  const by = groupPayments(data.payments);
  const batchById = new Map((data.allBatches || data.batches).map((b) => [b.id, b]));
  const known = new Set(batchById.keys());
  const out = [];

  for (const student of data.students) {
    if (!student.active) continue;
    const batch = batchById.get(student.batch_id);
    if (!batch || batch.deleted_at) continue;
    const months = [];
    let amount = 0;
    let partial = false;
    for (const m of monthsBetween(student.joined_month, month)) {
      const fee = feeFor(batchById.get(batchAt(student, m, known)) || batch, m);
      const ms = monthStatus(by.get(`${student.id}|${m}`) || [], fee);
      if (ms.settled) continue;
      months.push(m);
      amount += ms.status === 'part' ? ms.balance : fee;
      if (ms.status === 'part') partial = true;
    }
    if (!months.length) continue;
    out.push({ student, batch, months, amount, partial });
  }

  out.sort(
    (a, b) =>
      a.months[0].localeCompare(b.months[0]) ||
      b.amount - a.amount ||
      a.student.name.localeCompare(b.student.name),
  );
  return out;
}
