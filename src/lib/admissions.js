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

// Deleted applications wait here (like deleted students) until restored or deleted forever.
// Quietly empty when offline or the table isn't there.
export async function loadDeletedApplications() {
  if (!supabase || (typeof navigator !== 'undefined' && navigator.onLine === false)) return [];
  const { data, error } = await supabase
    .from('applications')
    .select('id, admission_id, student_name, class, status, marksheet_path, deleted_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(500);
  return error ? [] : data;
}

export const restoreApplication = (id) => updateApplication(id, { deleted_at: null });

// Delete forever: the row and its marksheet file.
export async function purgeApplication(a) {
  check(await supabase.from('applications').delete().eq('id', a.id));
  if (a.marksheet_path) await supabase.storage.from('marksheets').remove([a.marksheet_path]).catch(() => {});
}

// ---- Admission stats --------------------------------------------------------------------------------------------
// Counted by the month the application came in. "Enrolled" and "Dropped" are the application's status.
export const CLASS_ORDER = ['5', '6', '7', '8', '9', '10', '11', '12', 'Dropper', '11+NEET', '12+NEET'];
export const LOCATION_ORDER = ['Habra', 'Jaguli', 'Haringhata', 'Gobardanga', 'Nahata'];
export const REFERRED_ORDER = ['Teacher', 'Student', 'Friend', 'Senior', 'Social media', 'Other'];
export const SCORE_BANDS = [
  ['Below 50%', 0, 50],
  ['50–59%', 50, 60],
  ['60–69%', 60, 70],
  ['70–79%', 70, 80],
  ['80–89%', 80, 90],
  ['90%+', 90, Infinity],
];
// Droppers give NEET marks out of 720, which can't be compared with a percentage, so they get a group of their own.
export const NEET_MARKS = 'NEET marks (out of 720)';
export const bandOf = (a) => {
  if (Number(a.result_total) === 720) return NEET_MARKS;
  const p = Number(a.result_percent);
  if (!Number.isFinite(p)) return '';
  return (SCORE_BANDS.find(([, lo, hi]) => p >= lo && p < hi) || [''])[0];
};

export const STAT_FILTERS = {
  class: { label: 'Class', options: CLASS_ORDER, get: (a) => a.class },
  location: { label: 'Location', options: LOCATION_ORDER, get: (a) => a.batch_location },
  result: { label: 'Result', options: [...SCORE_BANDS.map((b) => b[0]), NEET_MARKS], get: bandOf },
  referred: { label: 'Referred from', options: REFERRED_ORDER, get: (a) => a.referred_from },
};
export const NO_FILTERS = { class: [], location: [], result: [], referred: [] };

// An application stays in when, for every filter that has something picked, it matches one of the picks.
export function filterApplications(apps, sel) {
  return apps.filter((a) => Object.entries(STAT_FILTERS).every(([k, f]) => !sel[k]?.length || sel[k].includes(f.get(a))));
}

export function totals(apps) {
  const t = { applied: apps.length, enrolled: 0, dropped: 0 };
  for (const a of apps) {
    if (a.status === 'enrolled') t.enrolled += 1;
    if (a.status === 'dropped') t.dropped += 1;
  }
  return { ...t, rate: t.applied ? Math.round((t.enrolled / t.applied) * 100) : 0 };
}

// One row per month, newest first, from the first application ever received up to now (at most 24 months).
// The range comes from all applications, so it doesn't jump around when filters change.
export function monthlyRows(filtered, all, now = new Date(), max = 24) {
  const key = (d) => d.getFullYear() * 12 + d.getMonth();
  const first = all.length ? Math.min(...all.map((a) => key(new Date(a.created_at)))) : key(now);
  const last = key(now);
  const rows = [];
  for (let k = last; k >= Math.max(first, last - max + 1); k--) {
    const d = new Date(Math.floor(k / 12), k % 12, 1);
    rows.push({ k, label: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }), applied: 0, enrolled: 0, dropped: 0 });
  }
  const byKey = new Map(rows.map((r) => [r.k, r]));
  for (const a of filtered) {
    const r = byKey.get(key(new Date(a.created_at)));
    if (!r) continue;
    r.applied += 1;
    if (a.status === 'enrolled') r.enrolled += 1;
    if (a.status === 'dropped') r.dropped += 1;
  }
  return rows;
}
