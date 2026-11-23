// Nightly backup of everything in the fee register.
//  - Vercel's timer calls this with the cron secret (see vercel.json).
//  - The app's "Back up now" button calls it with the teacher's login.
// Each backup is saved in the private Supabase "backups" bucket (the last 30 days are kept) and sent to the
// teacher's Telegram chat as a file. If anything fails, the teacher gets a message saying so.
import { all, config, db, istNow, ok, ownerFromToken, sendTelegram } from './_lib.js';
import { backupName, buildBackup, expiredNames, summaryLine } from './_backup.js';

const storage = (path, init = {}) => {
  const { supaUrl, serviceKey } = config();
  return fetch(`${supaUrl}/storage/v1/${path}`, { ...init, headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, ...(init.headers || {}) } });
};

async function sendFile(chatId, name, json, caption) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('disable_notification', 'true');
  form.append('caption', caption);
  form.append('document', new Blob([json], { type: 'application/json' }), name);
  const r = await fetch(`https://api.telegram.org/bot${config().botToken}/sendDocument`, { method: 'POST', body: form });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`Telegram: ${j.description || r.status}`);
}

export async function backupOwner(owner, { date }) {
  const [batches, students, payments, applications] = await Promise.all(['batches', 'students', 'payments', 'applications'].map((t) => all(t, owner)));
  const backup = buildBackup({ batches, students, payments, applications });
  const json = JSON.stringify(backup);
  const name = backupName(date);
  const line = summaryLine(backup);
  const result = { saved: false, sent: false, line };
  const problems = [];

  const up = await storage(`object/backups/${owner}/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-upsert': 'true' }, body: json });
  if (up.ok) result.saved = true;
  else problems.push(`Supabase ${up.status}: ${(await up.text()).slice(0, 120)}`);

  if (result.saved) {
    try {
      const ls = await storage(`object/list/backups`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefix: `${owner}/`, limit: 500, sortBy: { column: 'name', order: 'asc' } }) });
      const old = expiredNames(((await ls.json()) || []).map((f) => f.name), date);
      if (old.length) await storage('object/backups', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: old.map((n) => `${owner}/${n}`) }) });
      result.deletedOld = old.length;
    } catch (e) {
      problems.push(`Clean-up: ${e.message}`);
    }
  }

  const [cfg] = await db('GET', `reminder_settings?select=teacher_chat_id&owner_id=eq.${owner}`);
  if (cfg?.teacher_chat_id) {
    try {
      await sendFile(cfg.teacher_chat_id, name, json, `🗄 Backup ${date}\n${line}\nKeep this file. Restore it from Settings → Restore from backup.`);
      result.sent = true;
    } catch (e) {
      problems.push(e.message);
    }
    if (problems.length) await sendTelegram(cfg.teacher_chat_id, `⚠️ Tonight's backup had a problem:\n${problems.join('\n')}\n\nOpen the app → Settings → Download backup to save one by hand.`);
  }
  if (problems.length) result.problems = problems;
  return result;
}

export default async function handler(req, res) {
  const cfg = config();
  if (!cfg.supaUrl || !cfg.serviceKey || !cfg.botToken) return ok(res, { error: 'Not set up yet (missing environment variables)' }, 500);
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { date } = istNow();
  try {
    if (cfg.cronSecret && bearer === cfg.cronSecret) {
      const owners = [...new Set((await db('GET', 'batches?select=owner_id')).map((r) => r.owner_id))];
      const out = [];
      for (const o of owners) {
        try {
          out.push(await backupOwner(o, { date }));
        } catch (e) {
          out.push({ error: String(e.message || e) });
          const [c] = await db('GET', `reminder_settings?select=teacher_chat_id&owner_id=eq.${o}`).catch(() => []);
          if (c?.teacher_chat_id) await sendTelegram(c.teacher_chat_id, `⚠️ Tonight's backup failed: ${String(e.message || e).slice(0, 150)}\n\nOpen the app → Settings → Download backup to save one by hand.`).catch(() => {});
        }
      }
      return ok(res, { ok: true, results: out });
    }
    const owner = bearer ? await ownerFromToken(bearer) : null;
    if (!owner) return ok(res, { error: 'Not allowed' }, 401);
    return ok(res, { ok: true, ...(await backupOwner(owner, { date })) });
  } catch (e) {
    return ok(res, { error: String(e.message || e) }, 500);
  }
}
