import { batchAt } from './calc';
import { addMonths, dateLabel, longDateLabel, monthLabel, monthShort, pad, todayISO } from './dates';

// Money counted by the day it was received (paid_on), not by the month it was paying for.

const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // noon, so daylight-saving shifts can't move the date
};
export const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const lastDay = (y, m) => new Date(y, m, 0).getDate();

export const KINDS = [
  ['day', 'Today'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['year', 'Year'],
];

// The first day of the period that contains `anchor` (weeks run Monday to Sunday, years Jan to Dec).
export function periodOf(kind, anchor) {
  const [y, m] = anchor.split('-').map(Number);
  const today = todayISO();
  if (kind === 'day') {
    return { kind, start: anchor, end: anchor, label: anchor === today ? 'Today' : longDateLabel(anchor) };
  }
  if (kind === 'week') {
    const start = addDays(anchor, -((parse(anchor).getDay() + 6) % 7));
    const end = addDays(start, 6);
    const here = today >= start && today <= end;
    return { kind, start, end, label: here ? 'This week' : `${dateLabel(start)} – ${dateLabel(end)}` };
  }
  if (kind === 'month') {
    const key = `${y}-${pad(m)}`;
    return { kind, start: `${key}-01`, end: `${key}-${pad(lastDay(y, m))}`, label: key === today.slice(0, 7) ? 'This month' : monthLabel(key) };
  }
  return { kind, start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) === today.slice(0, 4) ? 'This year' : String(y) };
}

// Move to the previous (-1) or next (+1) period; returns the new anchor date.
export function step(kind, anchor, dir) {
  if (kind === 'day') return addDays(anchor, dir);
  if (kind === 'week') return addDays(anchor, 7 * dir);
  if (kind === 'month') return `${addMonths(anchor.slice(0, 7), dir)}-01`;
  return `${Number(anchor.slice(0, 4)) + dir}-01-01`;
}

// You can't look at a period that hasn't started yet.
export const canGoNext = (kind, anchor) => periodOf(kind, step(kind, anchor, 1)).start <= todayISO();

export function summarise(data, period, batchId) {
  const student = new Map(data.students.map((s) => [s.id, s]));
  const batch = new Map((data.allBatches || data.batches).map((b) => [b.id, b]));
  const known = new Set(batch.keys());
  // the batch a payment counts for is the one the student was in for the month it paid
  const batchOf = (p) => batch.get(batchAt(student.get(p.student_id), p.month, known));
  const inRange = data.payments.filter((p) => p.paid_on >= period.start && p.paid_on <= period.end && student.has(p.student_id));

  // overall split by batch (always across every batch, so the picker totals add up)
  const by = new Map();
  for (const p of inRange) {
    const b = batchOf(p);
    if (!b) continue;
    const e = by.get(b.id) || { batch: b, amount: 0, count: 0 };
    e.amount += p.amount;
    e.count += 1;
    by.set(b.id, e);
  }
  const batches = [...by.values()].sort((a, b) => b.amount - a.amount);

  const rows = inRange
    .filter((p) => batchId === 'all' || batchOf(p)?.id === batchId)
    .map((p) => ({ payment: p, student: student.get(p.student_id), batch: batchOf(p) }))
    .sort((a, b) => b.payment.paid_on.localeCompare(a.payment.paid_on) || String(b.payment.created_at || '').localeCompare(String(a.payment.created_at || '')));
  const total = rows.reduce((t, r) => t + r.payment.amount, 0);

  // bars: a bar per day (week, month) or per month (year); none for a single day
  let buckets = [];
  if (period.kind === 'week' || period.kind === 'month') {
    const n = period.kind === 'week' ? 7 : Number(period.end.slice(8));
    buckets = Array.from({ length: n }, (_, i) => {
      const key = addDays(period.start, i);
      const label = period.kind === 'week' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i] : String(i + 1);
      return { key, label, amount: 0 };
    });
  } else if (period.kind === 'year') {
    buckets = Array.from({ length: 12 }, (_, i) => ({ key: `${period.start.slice(0, 4)}-${pad(i + 1)}`, label: monthShort(`2000-${pad(i + 1)}`)[0], amount: 0 }));
  }
  const at = new Map(buckets.map((b) => [b.key, b]));
  for (const r of rows) {
    const key = period.kind === 'year' ? r.payment.paid_on.slice(0, 7) : r.payment.paid_on;
    const b = at.get(key);
    if (b) b.amount += r.payment.amount;
  }
  return { total, count: rows.length, rows, batches, buckets };
}
