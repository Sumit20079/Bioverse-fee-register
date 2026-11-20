import { supabase } from './db';

// Applications come from the public Bio-Verse admission form. They live only on the server (like the Telegram
// data), so this screen needs internet.

export const STATUS_LABEL = { new: 'New', counselled: 'Counselled', enrolled: 'Enrolled', dropped: 'Dropped' };

const check = ({ error }) => {
  if (error) throw error;
};

export async function loadApplications() {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) throw error;
  return data;
}

// For the red number on the Overview row. Quietly 0 when offline or the table isn't there yet.
export async function newApplicantCount() {
  if (!supabase || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 0;
  const { count, error } = await supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'new').is('deleted_at', null);
  return error ? 0 : count || 0;
}

export async function updateApplication(id, patch) {
  check(await supabase.from('applications').update(patch).eq('id', id));
}

// The marksheet bucket is private: the file opens through a link that works for an hour.
export async function marksheetUrl(path) {
  const { data, error } = await supabase.storage.from('marksheets').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export const mainParent = (a) => (a.main_contact === 'father' ? { role: 'Father', name: a.father_name, phone: a.father_phone } : { role: 'Mother', name: a.mother_name, phone: a.mother_phone });

// "88.4%", "NEET 540 / 720", or "410 / 500 (82%)"
export function resultText(a) {
  const o = Number(a.result_obtained);
  const t = Number(a.result_total);
  const p = Number(a.result_percent);
  if (t === 100) return `${trim(o)}%`;
  if (t === 720) return `NEET ${trim(o)} / 720`;
  return `${trim(o)} / ${trim(t)} (${trim(p)}%)`;
}
const trim = (n) => String(Number(n.toFixed(2)));

export function ago(iso) {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const tail10 = (s) => String(s || '').replace(/\D/g, '').slice(-10);

// Ids of applications that look like the same student applying twice, or who are already in the fee register.
export function possibleDuplicates(apps, students) {
  const byPhone = new Map();
  const byNameSchool = new Map();
  const add = (map, k, id) => {
    if (!k) return;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(id);
  };
  for (const a of apps) {
    add(byPhone, tail10(a.student_phone), a.id);
    add(byNameSchool, `${norm(a.student_name)}|${norm(a.school)}`, a.id);
  }
  const dup = new Set();
  for (const ids of [...byPhone.values(), ...byNameSchool.values()]) if (ids.length > 1) ids.forEach((i) => dup.add(i));
  const registered = new Set(students.map((s) => tail10(s.phone)).filter(Boolean));
  for (const a of apps) if (a.status !== 'enrolled' && registered.has(tail10(a.student_phone))) dup.add(a.id);
  return dup;
}

// The fee-register student made from an application. The student gets the application's own id, so pressing Enroll
// a second time (after a hiccup) updates the same student instead of adding a second one.
// Reminders go to the parent the family chose as main contact.
export function studentFromApplication(a, batchId, month) {
  return {
    id: a.id,
    name: a.student_name.trim(),
    phone: String(a.student_phone || '').replace(/\D/g, ''),
    parent_phone: String(mainParent(a).phone || '').replace(/\D/g, ''),
    batch_id: batchId,
    joined_month: month,
    active: true,
  };
}

// Follow-ups: applicants who asked for counselling or the scholarship test and haven't had it yet.
// Dropped applicants are left out of the pending lists.
export const counsellingPending = (a) => a.wants_counselling && !a.counselling_done && a.status !== 'dropped';
export const scholarshipPending = (a) => a.wants_scholarship && !a.scholarship_done && a.status !== 'dropped';
