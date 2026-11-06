import { createClient } from '@supabase/supabase-js';
import { addMonths, currentMonth, pad } from './dates';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;
// With no Supabase keys, or when someone chose "Try the demo", the app runs on sample data kept in this browser only.
const GUEST_KEY = 'fee-register-guest';
const readGuest = () => {
  try {
    return localStorage.getItem(GUEST_KEY) === '1';
  } catch {
    return false;
  }
};
export const isGuest = !!supabase && readGuest();
export const isDemo = !supabase || isGuest;

export function enterGuest() {
  try {
    localStorage.setItem(GUEST_KEY, '1');
  } catch {
    /* blocked storage: the demo just won't survive a reload */
  }
  location.reload();
}
export function exitGuest() {
  try {
    localStorage.removeItem(GUEST_KEY);
    localStorage.removeItem('fee-register-demo-v1');
  } catch {
    /* nothing to clean */
  }
  location.reload();
}

const asMonth = (d) => String(d).slice(0, 7);
const asDate = (m) => `${m}-01`;

/* ---------- Supabase backend ---------- */

// Supabase returns at most 1000 rows per request, so page through.
async function fetchAll(table) {
  const out = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + size - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

// Turns the raw tables into what the app uses: only live rows, plus the "Recently deleted" lists.
// A batch deleted together with its students is one group (they share the same deleted_at).
function shape(raw) {
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

  return { batches: liveBatches, students, payments, trash: { batches: trashBatches, students: trashStudents } };
}

const stamp = () => new Date().toISOString();
const chunks = (ids) => {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) out.push(ids.slice(i, i + 100));
  return out;
};

const check = ({ error }) => {
  if (error) throw error;
};

const studentRow = (s) => ({
  name: s.name,
  phone: s.phone || '',
  parent_phone: s.parent_phone || '',
  batch_id: s.batch_id,
  joined_month: asDate(s.joined_month),
  active: s.active ?? true,
});

const remote = {
  async load() {
    const [batches, students, payments] = await Promise.all([
      fetchAll('batches'),
      fetchAll('students'),
      fetchAll('payments'),
    ]);
    return shape({
      batches,
      students: students.map((s) => ({ ...s, joined_month: asMonth(s.joined_month) })),
      payments: payments.map((p) => ({ ...p, month: asMonth(p.month) })),
    });
  },
  // Everything in the database as plain data, including what is in "Recently deleted".
  async backup() {
    const [batches, students, payments] = await Promise.all([
      fetchAll('batches'),
      fetchAll('students'),
      fetchAll('payments'),
    ]);
    return { batches, students, payments };
  },
  async saveBatch(b) {
    const row = { name: b.name, fee: b.fee, ...(b.fee_history ? { fee_history: b.fee_history } : {}) };
    check(b.id ? await supabase.from('batches').update(row).eq('id', b.id) : await supabase.from('batches').insert(row));
  },
  async saveStudent(s) {
    const row = studentRow(s);
    check(s.id ? await supabase.from('students').update(row).eq('id', s.id) : await supabase.from('students').insert(row));
  },
  async addStudents(list) {
    check(await supabase.from('students').insert(list.map(studentRow)));
  },
  // A month can have several payments. With an id this edits that one; without, it adds a new one.
  async savePayment(p) {
    const row = { student_id: p.student_id, month: asDate(p.month), amount: p.amount, paid_on: p.paid_on, note: p.note || '', settled: p.settled ?? true };
    check(p.id ? await supabase.from('payments').update(row).eq('id', p.id) : await supabase.from('payments').insert(row));
  },
  async removePayments(ids) {
    for (let i = 0; i < ids.length; i += 100) {
      check(await supabase.from('payments').delete().in('id', ids.slice(i, i + 100)));
    }
  },
  // Adds the rows in `plan` (see lib/restore.js). Batches first, then students, then payments,
  // so every row finds its parent. owner_id is left out so it becomes the signed-in teacher.
  async restore(plan) {
    const strip = ({ owner_id, ...row }) => row; // eslint-disable-line no-unused-vars
    const put = async (table, rows) => {
      for (let i = 0; i < rows.length; i += 500) {
        check(await supabase.from(table).upsert(rows.slice(i, i + 500), { onConflict: 'id', ignoreDuplicates: true }));
      }
    };
    await put('batches', plan.batches.map(strip));
    await put('students', plan.students.map((s) => ({ ...strip(s), joined_month: asDate(asMonth(s.joined_month)) })));
    await put('payments', plan.payments.map((p) => ({ ...strip(p), month: asDate(asMonth(p.month)) })));
  },
  // rows: [{id, batch_id, batch_history}]. Returns false when the database has no batch_history column yet
  // (supabase/add-move-history.sql not run): the students still move, but without remembering where they were.
  async moveStudents(rows) {
    let saved = true;
    for (const r of rows) {
      let { error } = await supabase.from('students').update({ batch_id: r.batch_id, batch_history: r.batch_history }).eq('id', r.id);
      if (error && /batch_history/i.test(`${error.message} ${error.details || ''}`)) {
        saved = false;
        ({ error } = await supabase.from('students').update({ batch_id: r.batch_id }).eq('id', r.id));
      }
      if (error) throw error;
    }
    return saved;
  },
  // Deleting moves things to "Recently deleted" (deleted_at is set); nothing is erased until
  // someone chooses "Delete forever".
  async deleteStudent(id) {
    await remote.deleteStudents([id]);
  },
  async deleteStudents(ids) {
    const t = stamp();
    await Promise.all(chunks(ids).map(async (c) => check(await supabase.from('students').update({ deleted_at: t }).in('id', c))));
  },
  async deleteBatch(id) {
    const t = stamp();
    check(await supabase.from('students').update({ deleted_at: t }).eq('batch_id', id).is('deleted_at', null));
    check(await supabase.from('batches').update({ deleted_at: t }).eq('id', id));
  },
  // Bringing a student back also brings back their batch if that was deleted too.
  async restoreStudents(ids) {
    const batchIds = new Set();
    await Promise.all(
      chunks(ids).map(async (c) => {
        const { data, error } = await supabase.from('students').update({ deleted_at: null }).in('id', c).select('batch_id');
        if (error) throw error;
        data.forEach((r) => batchIds.add(r.batch_id));
      }),
    );
    if (batchIds.size) check(await supabase.from('batches').update({ deleted_at: null }).in('id', [...batchIds]));
  },
  // Restores the batch and the students that went with it (not ones deleted separately earlier).
  async restoreBatch(id) {
    const { data, error } = await supabase.from('batches').select('deleted_at').eq('id', id).single();
    if (error) throw error;
    check(await supabase.from('batches').update({ deleted_at: null }).eq('id', id));
    if (data.deleted_at) check(await supabase.from('students').update({ deleted_at: null }).eq('batch_id', id).eq('deleted_at', data.deleted_at));
  },
  // Permanent. Payments go with their student (on delete cascade). The database won't drop a
  // batch that still has students, so those are removed first.
  async purgeStudents(ids) {
    await Promise.all(chunks(ids).map(async (c) => check(await supabase.from('students').delete().in('id', c))));
  },
  // Whole bin in two requests instead of hundreds. `upTo` is the newest deleted_at the person was
  // looking at, so something deleted on another phone a moment later is left alone.
  async purgeTrash(upTo) {
    check(await supabase.from('students').delete().not('deleted_at', 'is', null).lte('deleted_at', upTo));
    check(await supabase.from('batches').delete().not('deleted_at', 'is', null).lte('deleted_at', upTo));
  },
  async restoreTrash(upTo) {
    check(await supabase.from('batches').update({ deleted_at: null }).not('deleted_at', 'is', null).lte('deleted_at', upTo));
    check(await supabase.from('students').update({ deleted_at: null }).not('deleted_at', 'is', null).lte('deleted_at', upTo));
  },
  async purgeBatch(id) {
    check(await supabase.from('students').delete().eq('batch_id', id));
    check(await supabase.from('batches').delete().eq('id', id));
  },
};

/* ---------- Demo backend (localStorage) ---------- */

const KEY = 'fee-register-demo-v1';
let memory = null; // fallback if localStorage is blocked

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

function seed() {
  const now = currentMonth();
  const prev = addMonths(now, -1);
  const b11 = { id: uid(), name: 'Class 11 Bio · Morning', fee: 1500 };
  const b12 = { id: uid(), name: 'Class 12 Bio · Evening', fee: 2000 };
  const b10 = { id: uid(), name: 'Class 10 Science · Sunday', fee: 1000 };
  // parent number is the student's number with the last digit changed, just for the sample data
  const mk = (batch, name, phone, joined) => ({
    id: uid(),
    batch_id: batch.id,
    name,
    phone,
    parent_phone: phone.slice(0, -1) + ((Number(phone.slice(-1)) + 5) % 10),
    joined_month: joined,
    active: true,
  });
  const students = [
    mk(b12, 'Aarav Das', '9830012345', prev),
    mk(b12, 'Ishita Roy', '9830012346', prev),
    mk(b12, 'Rahul Mondal', '9830012347', prev),
    mk(b12, 'Sneha Ghosh', '9830012348', prev),
    mk(b12, 'Subham Paul', '9830012349', now),
    mk(b11, 'Tanmay Biswas', '9830012350', prev),
    mk(b11, 'Riya Chakraborty', '9830012351', prev),
    mk(b11, 'Ananya Sen', '9830012352', now),
    mk(b10, 'Soumya Pal', '9830012353', now),
    mk(b10, 'Priyanka Bose', '9830012354', now),
  ];
  const day = (n) => `${now}-${pad(n)}`;
  const pay = (s, month, amount, paid_on, note = '') => ({ id: uid(), student_id: s.id, month, amount, paid_on, note });
  const payments = [
    pay(students[0], prev, 2000, `${prev}-04`),
    pay(students[0], now, 2000, day(3)),
    pay(students[1], prev, 2000, `${prev}-06`),
    pay(students[1], now, 2000, day(1)),
    pay(students[3], prev, 2000, `${prev}-07`),
    pay(students[3], now, 1800, day(1), 'sibling discount'),
    { ...pay(students[4], now, 1000, day(1), 'part payment'), settled: false },
    pay(students[5], prev, 1500, `${prev}-05`),
    pay(students[6], prev, 1500, `${prev}-05`),
    pay(students[6], now, 1500, day(1)),
    pay(students[7], now, 1500, day(1)),
    pay(students[9], now, 1000, day(1)),
  ];
  return { batches: [b11, b12, b10], students, payments };
}

function readDemo() {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return (memory = JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return (memory = seed());
}

function writeDemo(data) {
  memory = data;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

const demo = {
  async load() {
    return shape(structuredClone(readDemo()));
  },
  async backup() {
    return structuredClone(readDemo());
  },
  async saveBatch(b) {
    const d = readDemo();
    if (b.id) d.batches = d.batches.map((x) => (x.id === b.id ? { ...x, name: b.name, fee: b.fee, ...(b.fee_history ? { fee_history: b.fee_history } : {}) } : x));
    else d.batches.push({ id: uid(), name: b.name, fee: b.fee });
    writeDemo(d);
  },
  async saveStudent(s) {
    const d = readDemo();
    const row = studentRow(s);
    row.joined_month = s.joined_month;
    if (s.id) d.students = d.students.map((x) => (x.id === s.id ? { ...x, ...row } : x));
    else d.students.push({ id: uid(), ...row });
    writeDemo(d);
  },
  async addStudents(list) {
    const d = readDemo();
    for (const s of list) d.students.push({ id: uid(), ...studentRow(s), joined_month: s.joined_month });
    writeDemo(d);
  },
  async savePayment(p) {
    const d = readDemo();
    const row = { student_id: p.student_id, month: p.month, amount: p.amount, paid_on: p.paid_on, note: p.note || '', settled: p.settled ?? true };
    const i = p.id ? d.payments.findIndex((x) => x.id === p.id) : -1;
    if (i >= 0) d.payments[i] = { ...d.payments[i], ...row };
    else d.payments.push({ id: uid(), ...row });
    writeDemo(d);
  },
  async removePayments(ids) {
    const gone = new Set(ids);
    const d = readDemo();
    d.payments = d.payments.filter((x) => !gone.has(x.id));
    writeDemo(d);
  },
  async restore(plan) {
    const d = readDemo();
    d.batches.push(...plan.batches);
    d.students.push(...plan.students.map((s) => ({ ...s, joined_month: asMonth(s.joined_month) })));
    d.payments.push(...plan.payments.map((x) => ({ ...x, month: asMonth(x.month) })));
    writeDemo(d);
  },
  async moveStudents(rows) {
    const by = new Map(rows.map((r) => [r.id, r]));
    const d = readDemo();
    d.students = d.students.map((x) => (by.has(x.id) ? { ...x, batch_id: by.get(x.id).batch_id, batch_history: by.get(x.id).batch_history } : x));
    writeDemo(d);
    return true;
  },
  async deleteStudent(id) {
    await demo.deleteStudents([id]);
  },
  async deleteStudents(ids) {
    const gone = new Set(ids);
    const t = stamp();
    const d = readDemo();
    d.students = d.students.map((x) => (gone.has(x.id) ? { ...x, deleted_at: t } : x));
    writeDemo(d);
  },
  async deleteBatch(id) {
    const t = stamp();
    const d = readDemo();
    d.students = d.students.map((x) => (x.batch_id === id && !x.deleted_at ? { ...x, deleted_at: t } : x));
    d.batches = d.batches.map((b) => (b.id === id ? { ...b, deleted_at: t } : b));
    writeDemo(d);
  },
  async restoreStudents(ids) {
    const back = new Set(ids);
    const d = readDemo();
    const batchIds = new Set(d.students.filter((x) => back.has(x.id)).map((x) => x.batch_id));
    d.students = d.students.map((x) => (back.has(x.id) ? { ...x, deleted_at: null } : x));
    d.batches = d.batches.map((b) => (batchIds.has(b.id) ? { ...b, deleted_at: null } : b));
    writeDemo(d);
  },
  async restoreBatch(id) {
    const d = readDemo();
    const t = d.batches.find((b) => b.id === id)?.deleted_at;
    d.batches = d.batches.map((b) => (b.id === id ? { ...b, deleted_at: null } : b));
    if (t) d.students = d.students.map((x) => (x.batch_id === id && x.deleted_at === t ? { ...x, deleted_at: null } : x));
    writeDemo(d);
  },
  async purgeTrash(upTo) {
    const old = (x) => x.deleted_at && Date.parse(x.deleted_at) <= Date.parse(upTo);
    const d = readDemo();
    const gone = new Set(d.students.filter(old).map((s) => s.id));
    d.payments = d.payments.filter((p) => !gone.has(p.student_id));
    d.students = d.students.filter((s) => !gone.has(s.id));
    d.batches = d.batches.filter((b) => !old(b));
    writeDemo(d);
  },
  async restoreTrash(upTo) {
    const old = (x) => x.deleted_at && Date.parse(x.deleted_at) <= Date.parse(upTo);
    const d = readDemo();
    d.batches = d.batches.map((b) => (old(b) ? { ...b, deleted_at: null } : b));
    d.students = d.students.map((s) => (old(s) ? { ...s, deleted_at: null } : s));
    writeDemo(d);
  },
  async purgeStudents(ids) {
    const gone = new Set(ids);
    const d = readDemo();
    d.students = d.students.filter((s) => !gone.has(s.id));
    d.payments = d.payments.filter((p) => !gone.has(p.student_id));
    writeDemo(d);
  },
  async purgeBatch(id) {
    const d = readDemo();
    const gone = new Set(d.students.filter((s) => s.batch_id === id).map((s) => s.id));
    d.payments = d.payments.filter((p) => !gone.has(p.student_id));
    d.students = d.students.filter((s) => s.batch_id !== id);
    d.batches = d.batches.filter((b) => b.id !== id);
    writeDemo(d);
  },
};

export const backend = isDemo ? demo : remote;
