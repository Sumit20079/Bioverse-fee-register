import { supabase } from './db';

export const BOT = import.meta.env.VITE_TELEGRAM_BOT || 'bioverse_manager_bot';
export const tgLink = (student) => (student?.tg_token ? `https://t.me/${BOT}?start=${student.tg_token}` : null);

export const teacherLink = (token) => (token ? `https://t.me/${BOT}?start=${token}` : null);

export const DEFAULT_SETTINGS = { mode: 'manual', day: 28, every_days: 3, message: '', receipts: true, warn_days: 0, summary: false, notify_connect: true };

// Who is connected on Telegram, as Map(student id -> number of chats). Empty when offline or not set up yet.
export async function loadLinked() {
  if (!supabase) return { ready: false, linked: new Map() };
  const { data, error } = await supabase.from('parent_chats').select('student_id');
  if (error) return { ready: false, linked: new Map() };
  const linked = new Map();
  for (const r of data) linked.set(r.student_id, (linked.get(r.student_id) || 0) + 1);
  return { ready: true, linked };
}

export async function loadSettings() {
  const { data, error } = await supabase.from('reminder_settings').select('*').maybeSingle();
  if (error) throw error;
  return { ...DEFAULT_SETTINGS, ...(data || {}), message: data?.message || '' };
}

export async function saveSettings(s) {
  const { data: u } = await supabase.auth.getUser();
  const row = { owner_id: u.user.id, mode: s.mode, day: Number(s.day), every_days: Number(s.every_days), message: s.message.trim() || null, receipts: s.receipts !== false, warn_days: Number(s.warn_days) || 0, summary: !!s.summary, notify_connect: s.notify_connect !== false, updated_at: new Date().toISOString() };
  const { error } = await supabase.from('reminder_settings').upsert(row, { onConflict: 'owner_id' });
  if (error) throw error;
}

// The "Send now" button: the server sends to every connected parent who owes money.
export async function sendNow() {
  const { data } = await supabase.auth.getSession();
  const r = await fetch('/api/remind', { method: 'POST', headers: { authorization: `Bearer ${data.session?.access_token}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server said ${r.status}`);
  return j;
}

// After a payment is saved: tell the connected parent on Telegram. Best effort, never blocks or errors the app.
export async function sendReceipt(payload) {
  try {
    if (!supabase || typeof navigator !== 'undefined' && navigator.onLine === false) return 0;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return 0;
    const r = await fetch('/api/receipt', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    return j.sent || 0;
  } catch {
    return 0;
  }
}
