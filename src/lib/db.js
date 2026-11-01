import { createClient } from '@supabase/supabase-js';
import { addMonths, currentMonth, pad } from './dates';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;
// With no Supabase keys the app runs on sample data kept in this browser only.
export const isDemo = !supabase;

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
    return {
      batches,
      students: students.map((s) => ({ ...s, joined_month: asMonth(s.joined_month) })),
      payments: payments.map((p) => ({ ...p, month: asMonth(p.month) })),
    };
  },
  async saveBatch(b) {
    const row = { name: b.name, fee: b.fee };
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
  // The database won't drop a batch that still has students (on delete restrict), so remove the
  // students first. Their payments go with them (on delete cascade). If the second step fails the
  // students are already gone, and retrying the delete finishes the job.
  async deleteBatch(id) {
    check(await supabase.from('students').delete().eq('batch_id', id));
    check(await supabase.from('batches').delete().eq('id', id));
  },
  // Deleting a student also deletes their payments (on delete cascade).
  async deleteStudent(id) {
    check(await supabase.from('students').delete().eq('id', id));
  },
  async deleteStudents(ids) {
    for (let i = 0; i < ids.length; i += 100) {
      check(await supabase.from('students').delete().in('id', ids.slice(i, i + 100)));
    }
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
    return structuredClone(readDemo());
  },
  async saveBatch(b) {
    const d = readDemo();
    if (b.id) d.batches = d.batches.map((x) => (x.id === b.id ? { ...x, name: b.name, fee: b.fee } : x));
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
  async deleteBatch(id) {
    const d = readDemo();
    const gone = new Set(d.students.filter((s) => s.batch_id === id).map((s) => s.id));
    d.payments = d.payments.filter((p) => !gone.has(p.student_id));
    d.students = d.students.filter((s) => s.batch_id !== id);
    d.batches = d.batches.filter((b) => b.id !== id);
    writeDemo(d);
  },
  async deleteStudent(id) {
    const d = readDemo();
    d.students = d.students.filter((s) => s.id !== id);
    d.payments = d.payments.filter((p) => p.student_id !== id);
    writeDemo(d);
  },
  async deleteStudents(ids) {
    const gone = new Set(ids);
    const d = readDemo();
    d.students = d.students.filter((s) => !gone.has(s.id));
    d.payments = d.payments.filter((p) => !gone.has(p.student_id));
    writeDemo(d);
  },
};

export const backend = isDemo ? demo : remote;
