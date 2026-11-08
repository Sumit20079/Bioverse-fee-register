// Shared by the Telegram functions. Runs on Vercel, never in the browser.
import { dueList, monthView } from '../src/lib/calc.js';
import { addMonths, monthLabel, monthsText } from '../src/lib/dates.js';
import { fillTemplate, rupees } from '../src/lib/format.js';
import { keyboardFor, langOf, paidButton, T } from './_i18n.js';
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
    res.students += 1;
    for (const c of mine) {
      const L = T(langOf(c));
      // the teacher's own wording is sent as typed; otherwise the standard message in the parent's language
      const text = settings.message
        ? fillTemplate(settings.message, { name: d.student.name, amount: d.amount, monthsLabel: monthsText(d.months), batchName: d.batch.name })
        : langOf(c) === 'bn'
          ? L.reminder({ name: d.student.name, amt: rupees(d.amount), months: L.months(d.months), batch: d.batch.name })
          : fillTemplate(settings.message, { name: d.student.name, amount: d.amount, monthsLabel: monthsText(d.months), batchName: d.batch.name });
      const r = await sendTelegram(c.chat_id, text, paidButton(langOf(c), d.student.id));
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
export const KEYBOARD = keyboardFor('en');
export const keyboardForChat = (chat) => keyboardFor(langOf(chat));

// "/status": what this child owes right now, and the last payment.
export async function statusText(chat) {
  const L = T(langOf(chat));
  const data = await loadData(chat.owner_id);
  const student = data.students.find((s) => s.id === chat.student_id);
  if (!student) return L.gone;
  const t = istNow();
  const row = dueList(data, t.month).find((d) => d.student.id === student.id);
  const mine = data.payments.filter((p) => p.student_id === student.id && p.amount > 0).sort((a, b) => (b.paid_on || '').localeCompare(a.paid_on || '') || b.month.localeCompare(a.month));
  const last = mine[0];
  const lines = [L.statusTitle(student.name)];
  if (row) lines.push(L.pending(L.months(row.months), rupees(row.amount), row.partial));
  else lines.push(L.allPaid(L.month(t.month)));
  if (last) lines.push(L.lastPay(rupees(last.amount), L.month(last.month), last.paid_on ? String(last.paid_on).slice(0, 10) : ''));
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
  let sent = 0;
  for (const c of chats) {
    const L = T(langOf(c));
    const text = L.receipt({ name: st.name, amt: rupees(amount), month: L.month(month), batch: batchName, on: paidOn, balance });
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
  const L = T(langOf(chat));
  if (!student) return L.gone;
  const by = new Map();
  for (const p of data.payments) {
    if (p.student_id !== student.id || !(p.amount > 0)) continue;
    const e = by.get(p.month) || { amount: 0, on: '' };
    e.amount += p.amount;
    if ((p.paid_on || '') > e.on) e.on = String(p.paid_on || '').slice(0, 10);
    by.set(p.month, e);
  }
  const months = [...by.keys()].sort().reverse();
  if (!months.length) return L.histNone(student.name);
  const shown = months.slice(0, 12);
  const lines = shown.map((m) => `• ${L.month(m)}: ${rupees(by.get(m).amount)}${by.get(m).on ? L.histPaid(by.get(m).on) : ''}`);
  return `${L.histTitle(student.name)}\n${lines.join('\n')}${months.length > shown.length ? L.histMore(months.length - shown.length) : ''}`;
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
      const L = T(langOf(c));
      const text = L.headsUp({ name: d.student.name, batch: d.batch.name, month: L.month(t.month), amt: rupees(d.amount), day: settings.day });
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

// One announcement to every connected parent (all students, or one batch). A parent linked to two kids gets it once.
export async function announceOwner(owner, { text, batchId = null }) {
  const clean = String(text || '').trim().slice(0, 3000);
  if (!clean) return { sent: 0, failed: 0 };
  const students = await db('GET', `students?select=id&owner_id=eq.${owner}&deleted_at=is.null&active=eq.true${batchId ? `&batch_id=eq.${batchId}` : ''}`);
  const ids = new Set(students.map((s) => s.id));
  const chats = await db('GET', `parent_chats?select=*&owner_id=eq.${owner}`);
  const seen = new Set();
  const out = { sent: 0, failed: 0 };
  for (const c of chats) {
    if (!ids.has(c.student_id) || seen.has(c.chat_id)) continue;
    seen.add(c.chat_id);
    const r = await sendTelegram(c.chat_id, `📢 ${clean}`);
    if (r.ok) out.sent += 1;
    else out.failed += 1;
    if (r.gone) await db('DELETE', `parent_chats?chat_id=eq.${c.chat_id}&owner_id=eq.${owner}`);
  }
  return out;
}

// The teacher answers a parent from the app.
export async function replyOwner(owner, { chatId, studentId, text }) {
  const clean = String(text || '').trim().slice(0, 3000);
  if (!clean) return { sent: false };
  const [link] = await db('GET', `parent_chats?select=*&owner_id=eq.${owner}&chat_id=eq.${Number(chatId)}&student_id=eq.${studentId}`);
  if (!link) return { sent: false, error: 'This parent is not connected any more' };
  const r = await sendTelegram(link.chat_id, `💬 Message from your teacher:\n${clean}`);
  if (!r.ok) return { sent: false, error: r.detail || 'Telegram refused it' };
  await db('POST', 'parent_messages', { owner_id: owner, student_id: link.student_id, chat_id: link.chat_id, chat_name: link.chat_name, direction: 'out', body: clean, read: true }, { prefer: 'return=minimal' });
  return { sent: true };
}

// A parent typed something to the bot: keep it for the teacher and ping their Telegram if connected.
export async function saveParentMessage(chatLinks, text, who) {
  const body = String(text).slice(0, 3000);
  const first = chatLinks[0];
  await db('POST', 'parent_messages', { owner_id: first.owner_id, student_id: first.student_id, chat_id: first.chat_id, chat_name: who || first.chat_name || '', direction: 'in', body }, { prefer: 'return=minimal' });
  const [cfg] = await db('GET', `reminder_settings?select=teacher_chat_id&owner_id=eq.${first.owner_id}`);
  if (cfg?.teacher_chat_id) {
    const [st] = await db('GET', `students?select=name&id=eq.${first.student_id}`);
    await sendTelegram(cfg.teacher_chat_id, `💬 ${who || 'A parent'}${st ? ` (${st.name})` : ''}:\n${body}\n\nReply from the app: Settings → Parent messages.`);
  }
}

// ---- "I've paid" claims and screenshots ----
export async function tg(method, body) {
  const { botToken } = config();
  const r = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r.json().catch(() => ({}));
}

// A parent says they paid. Keeps one open claim per student/chat per day. Returns the claim, or null when nothing is pending.
export async function createClaim(link, who) {
  const data = await loadData(link.owner_id);
  const row = dueList(data, istNow().month).find((d) => d.student.id === link.student_id);
  if (!row) return { claim: null, row: null, fresh: false };
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const [open] = await db('GET', `payment_claims?select=*&owner_id=eq.${link.owner_id}&student_id=eq.${link.student_id}&chat_id=eq.${link.chat_id}&status=eq.open&created_at=gte.${since}`);
  if (open) return { claim: open, row, fresh: false };
  const [claim] = await db('POST', 'payment_claims', { owner_id: link.owner_id, student_id: link.student_id, chat_id: link.chat_id, chat_name: who || link.chat_name || '', months: row.months.join(','), amount: row.amount });
  const [cfg] = await db('GET', `reminder_settings?select=teacher_chat_id&owner_id=eq.${link.owner_id}`);
  if (cfg?.teacher_chat_id) await sendTelegram(cfg.teacher_chat_id, `💰 ${who || 'A parent'} says ${row.student.name} has paid ${monthsText(row.months)} · ${rupees(row.amount)}.\nCheck it and record it: Settings → Payment claims.`);
  return { claim, row, fresh: true };
}

// Saves a payment screenshot the parent sent into private storage and links it to the claim.
export async function saveProof(claim, fileId) {
  const { supaUrl, serviceKey, botToken } = config();
  const f = await tg('getFile', { file_id: fileId });
  if (!f.ok || !f.result?.file_path) return false;
  const img = await fetch(`https://api.telegram.org/file/bot${botToken}/${f.result.file_path}`);
  if (!img.ok) return false;
  const buf = Buffer.from(await img.arrayBuffer());
  if (buf.length > 8 * 1024 * 1024) return false;
  const ext = (f.result.file_path.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  const path = `${claim.owner_id}/${claim.id}.${ext}`;
  const up = await fetch(`${supaUrl}/storage/v1/object/payment-proofs/${path}`, {
    method: 'POST',
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': ext === 'png' ? 'image/png' : 'image/jpeg', 'x-upsert': 'true' },
    body: buf,
  });
  if (!up.ok) return false;
  await db('PATCH', `payment_claims?id=eq.${claim.id}`, { proof_path: path });
  return true;
}
