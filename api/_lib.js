// Shared by the Telegram functions. Runs on Vercel, never in the browser.
import { dueList } from '../src/lib/calc.js';
import { monthsText } from '../src/lib/dates.js';
import { fillTemplate } from '../src/lib/format.js';
import { shape } from '../src/lib/shape.js';

const env = (k) => process.env[k] || '';
export const config = () => ({
  supaUrl: (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/$/, ''),
  serviceKey: env('SUPABASE_SERVICE_KEY'),
  botToken: env('TELEGRAM_BOT_TOKEN'),
  webhookSecret: env('TELEGRAM_WEBHOOK_SECRET'),
  cronSecret: env('CRON_SECRET'),
  botName: env('TELEGRAM_BOT_USERNAME') || 'bioverse_manager_bot',
});

export const ok = (res, body = { ok: true }, status = 200) => res.status(status).json(body);

// IST (UTC+5:30), because the teacher thinks in Indian dates
export function istNow() {
  const iso = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString();
  return { date: iso.slice(0, 10), month: iso.slice(0, 7), day: Number(iso.slice(8, 10)) };
}

// Supabase REST with the service key (full access: only ever used here, with an owner filter on every query)
export async function db(method, path, body, extra = {}) {
  const { supaUrl, serviceKey } = config();
  const r = await fetch(`${supaUrl}/rest/v1/${path}`, {
    method,
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json', prefer: 'return=representation', ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : [];
}

async function all(table, owner) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = await db('GET', `${table}?select=*&owner_id=eq.${owner}&order=created_at.asc,id.asc`, undefined, { range: `${from}-${from + 999}`, 'range-unit': 'items' });
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function loadData(owner) {
  const [batches, students, payments] = await Promise.all([all('batches', owner), all('students', owner), all('payments', owner)]);
  const m = (d) => String(d).slice(0, 7);
  return shape({
    batches,
    students: students.map((s) => ({ ...s, joined_month: m(s.joined_month) })),
    payments: payments.map((p) => ({ ...p, month: m(p.month) })),
  });
}

export async function sendTelegram(chatId, text) {
  const { botToken } = config();
  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: !!j.ok, gone: r.status === 403 || j.error_code === 403, detail: j.description || '' };
}

// Who gets a message today. 'now' = the teacher pressed Send now (ignores the schedule).
export function dueToday(settings, { today, day }, lastSent, now) {
  if (now) return true;
  if (settings.mode === 'once') return day === settings.day && lastSent !== today;
  if (settings.mode === 'repeat') {
    if (day < settings.day) return false;
    if (!lastSent) return true;
    const days = (Date.parse(today) - Date.parse(lastSent)) / 86400000;
    return days >= settings.every_days;
  }
  return false;
}

// Sends the reminders for one teacher. Returns counts.
export async function remindOwner(owner, settings, { now = false } = {}) {
  const t = istNow();
  const data = await loadData(owner);
  const due = dueList(data, t.month);
  const chats = await db('GET', `parent_chats?select=*&owner_id=eq.${owner}`);
  const log = await db('GET', `reminder_log?select=student_id,sent_at&owner_id=eq.${owner}&ok=eq.true&order=sent_at.desc&limit=5000`);
  const last = new Map();
  for (const l of log) if (!last.has(l.student_id)) last.set(l.student_id, new Date(new Date(l.sent_at).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10));

  const res = { sent: 0, failed: 0, skipped: 0, students: 0 };
  for (const d of due) {
    const mine = chats.filter((c) => c.student_id === d.student.id);
    if (!mine.length) continue;
    const lastSent = last.get(d.student.id);
    // never twice in one day, even for "Send now"
    if (lastSent === t.date || !dueToday(settings, t, lastSent, now)) {
      res.skipped += 1;
      continue;
    }
    const text = fillTemplate(settings.message, { name: d.student.name, amount: d.amount, monthsLabel: monthsText(d.months), batchName: d.batch.name });
    res.students += 1;
    for (const c of mine) {
      const r = await sendTelegram(c.chat_id, text);
      if (r.ok) res.sent += 1;
      else res.failed += 1;
      if (r.gone) await db('DELETE', `parent_chats?id=eq.${c.id}`); // blocked the bot: forget the link
      await db('POST', 'reminder_log', { owner_id: owner, student_id: d.student.id, ok: r.ok, detail: r.detail });
    }
  }
  return res;
}

export async function ownerFromToken(jwt) {
  const { supaUrl, serviceKey } = config();
  const r = await fetch(`${supaUrl}/auth/v1/user`, { headers: { apikey: serviceKey, authorization: `Bearer ${jwt}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return u.id || null;
}
