// Sends fee reminders to parents connected on Telegram.
//  - Vercel's daily timer calls this with the cron secret: sends according to each teacher's schedule.
//  - The app's "Send now" button calls it with the teacher's login: sends right away.
import { config, db, headsUpOwner, ok, ownerFromToken, remindOwner, summaryOwner } from './_lib.js';

const DEFAULTS = { mode: 'manual', day: 28, every_days: 3, message: null };

export default async function handler(req, res) {
  const cfg = config();
  if (!cfg.supaUrl || !cfg.serviceKey || !cfg.botToken) return ok(res, { error: 'Not set up yet (missing environment variables)' }, 500);
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try {
    if (cfg.cronSecret && bearer === cfg.cronSecret) {
      const rows = await db('GET', 'reminder_settings?select=*');
      const out = [];
      for (const s of rows) {
        const one = {};
        try {
          if (s.mode !== 'manual') one.reminders = await remindOwner(s.owner_id, s);
          one.headsUp = await headsUpOwner(s.owner_id, s);
          one.summary = await summaryOwner(s.owner_id, s);
        } catch (e) {
          one.error = String(e.message || e); // one teacher's problem must not stop the others
        }
        out.push(one);
      }
      return ok(res, { ok: true, teachers: out.length, results: out });
    }
    const owner = bearer ? await ownerFromToken(bearer) : null;
    if (!owner) return ok(res, { error: 'Not allowed' }, 401);
    const [row] = await db('GET', `reminder_settings?select=*&owner_id=eq.${owner}`);
    return ok(res, { ok: true, ...(await remindOwner(owner, { ...DEFAULTS, ...(row || {}) }, { now: true })) });
  } catch (e) {
    return ok(res, { error: String(e.message || e) }, 500);
  }
}
