// The app calls this to send test results to parents (only marks not sent yet, or changed since).
import { config, ok, ownerFromToken, sendResults } from './_lib.js';

export default async function handler(req, res) {
  const cfg = config();
  if (req.method !== 'POST') return ok(res, { error: 'POST only' }, 405);
  if (!cfg.supaUrl || !cfg.serviceKey || !cfg.botToken) return ok(res, { error: 'Not set up yet' }, 500);
  try {
    const owner = await ownerFromToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    if (!owner) return ok(res, { error: 'Not allowed' }, 401);
    const id = String((req.body || {}).exam_id || '');
    if (!/^[\w-]{8,64}$/.test(id)) return ok(res, { error: 'Bad test' }, 400);
    const r = await sendResults(owner, id);
    return ok(res, { ok: !r.missing, ...r }, r.missing ? 404 : 200);
  } catch (e) {
    return ok(res, { error: String(e.message || e) }, 500);
  }
}
