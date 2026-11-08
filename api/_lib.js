// Shared by the Telegram functions. Runs on Vercel, never in the browser.
import { dueList, monthView } from '../src/lib/calc.js';
import { addMonths, monthLabel, monthsText } from '../src/lib/dates.js';
import { fillTemplate, receiptText, rupees } from '../src/lib/format.js';
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

export async function sendTelegram(chatId, text, extra = {}) {
  const { botToken } = config();
  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true, ...extra }),
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

// Buttons shown under the chat box. Tapping one sends its text, which the webhook understands.
export const KEYBOARD = { reply_markup: { keyboard: [[{ text: '📊 Status' }, { text: '🧾 History' }, { text: '🔕 Stop reminders' }]], resize_keyboard: true, is_persistent: true } };

// "/status": what this child owes right now, and the last payment.
export async function statusText(chat) {
  const data = await loadData(chat.owner_id);
  const student = data.students.find((s) => s.id === chat.student_id);
  if (!student) return 'Sorry, this student is not in the register any more.';
  const t = istNow();
  const row = dueList(data, t.month).find((d) => d.student.id === student.id);
  const mine = data.payments.filter((p) => p.student_id === student.id && p.amount > 0).sort((a, b) => (b.paid_on || '').localeCompare(a.paid_on || '') || b.month.localeCompare(a.month));
  const last = mine[0];
  const lines = [`Fee status for ${student.name}`];
  if (row) lines.push(`Pending: ${monthsText(row.months)} · ${rupees(row.amount)}${row.partial ? ' (includes a part payment balance)' : ''}`);
  else lines.push(`All paid up till ${monthLabel(t.month)} ✅`);
  if (last) lines.push(`Last payment: ${rupees(last.amount)} for ${monthLabel(last.month)}${last.paid_on ? ` on ${String(last.paid_on).slice(0, 10)}` : ''}`);
  return lines.join('\n');
}

// Tells the parents of one student that a payment arrived. Returns how many got it.
export async function sendReceipt(owner, studentId, { amount, month, balance = 0, paidOn = '', batchName = '' }) {
  if (!(amount > 0) || !/^\d{4}-\d{2}$/.test(String(month))) return 0;
  const [st] = await db('GET', `students?select=id,name&id=eq.${studentId}&owner_id=eq.${owner}`);
  if (!st) return 0;
  const [cfg] = await db('GET', `reminder_settings?select=receipts&owner_id=eq.${owner}`);
  if (cfg && cfg.receipts === false) return 0;
  const chats = await db('GET', `parent_chats?select=*&owner_id=eq.${owner}&student_id=eq.${studentId}`);
  const text = receiptText({ name: st.name, amount, monthLabel: monthLabel(month), batchName, paidOn, balance, to: 'parent' });
  let sent = 0;
  for (const c of chats) {
    const r = await sendTelegram(c.chat_id, text);
    if (r.ok) sent += 1;
    if (r.gone) await db('DELETE', `parent_chats?id=eq.${c.id}`);
  }
  return sent;
}

// "/history": every month paid so far (newest first), with dates.
export async function historyText(chat) {
  const data = await loadData(chat.owner_id);
  const student = data.students.find((s) => s.id === chat.student_id);
  if (!student) return 'Sorry, this student is not in the register any more.';
  const by = new Map();
  for (const p of data.payments) {
    if (p.student_id !== student.id || !(p.amount > 0)) continue;
    const e = by.get(p.month) || { amount: 0, on: '' };
    e.amount += p.amount;
    if ((p.paid_on || '') > e.on) e.on = String(p.paid_on || '').slice(0, 10);
    by.set(p.month, e);
  }
  const months = [...by.keys()].sort().reverse();
  if (!months.length) return `No payments recorded yet for ${student.name}.`;
  const shown = months.slice(0, 12);
  const lines = shown.map((m) => `• ${monthLabel(m)}: ${rupees(by.get(m).amount)}${by.get(m).on ? ` (paid ${by.get(m).on})` : ''}`);
  return `Payment history for ${student.name}\n${lines.join('\n')}${months.length > shown.length ? `\n…and ${months.length - shown.length} earlier months` : ''}`;
}

// A gentle heads-up a few days BEFORE the reminder day, only for students whose only unpaid month is this one.
export async function headsUpOwner(owner, settings) {
  const t = istNow();
  if (!settings.warn_days || settings.mode === 'manual' || t.day !== settings.day - settings.warn_days) return { sent: 0 };
  const data = await loadData(owner);
  const chats = await db('GET', `parent_chats?select=*&owner_id=eq.${owner}`);
  let sent = 0;
  for (const d of dueList(data, t.month)) {
    if (d.months.length !== 1 || d.months[0] !== t.month) continue;
    for (const c of chats.filter((x) => x.student_id === d.student.id)) {
      const text = `Hello, a gentle heads-up: the tuition fee for ${d.student.name} (${d.batch.name}) for ${monthLabel(t.month)} (${rupees(d.amount)}) falls due on day ${settings.day}. Please ignore this if you have already paid. Thank you!`;
      const r = await sendTelegram(c.chat_id, text);
      if (r.ok) sent += 1;
      if (r.gone) await db('DELETE', `parent_chats?id=eq.${c.id}`);
    }
  }
  return { sent };
}

// On the 1st: last month's numbers, sent to the teacher's own Telegram.
export async function summaryOwner(owner, settings) {
  const t = istNow();
  if (!settings.summary || !settings.teacher_chat_id || t.day !== 1) return { sent: 0 };
  const data = await loadData(owner);
  const month = addMonths(t.month, -1);
  const v = monthView(data, month);
  const owing = v.batches.flatMap((b) => b.rows.filter((r) => r.owes).map((r) => r.student.name)).sort();
  const lines = [`Fee summary for ${monthLabel(month)}`, `Collected ${rupees(v.collected)} of ${rupees(v.expected)}`, `${v.paidCount} paid · ${v.dueCount} still due (${rupees(v.pending)})`];
  if (owing.length) lines.push('', `Still to pay: ${owing.slice(0, 15).join(', ')}${owing.length > 15 ? ` and ${owing.length - 15} more` : ''}`);
  const r = await sendTelegram(settings.teacher_chat_id, lines.join('\n'));
  return { sent: r.ok ? 1 : 0 };
}
