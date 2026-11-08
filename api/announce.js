// The app calls this to send one announcement to the connected parents (everyone, or one batch).
import { announceOwner, config, ok, ownerFromToken } from './_lib.js';

export default async function handler(req, res) {
  const cfg = config();
  if (req.method !== 'POST') return ok(res, { error: 'POST only' }, 405);
  if (!cfg.supaUrl || !cfg.serviceKey || !cfg.botToken) return ok(res, { error: 'Not set up yet' }, 500);
  try {
    const owner = await ownerFromToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    if (!owner) return ok(res, { error: 'Not allowed' }, 401);
    const b = req.body || {};
    const batchId = b.batch_id && /^[\w-]{8,64}$/.test(String(b.batch_id)) ? String(b.batch_id) : null;
    return ok(res, { ok: true, ...(await announceOwner(owner, { text: b.text, batchId })) });
  } catch (e) {
    return ok(res, { error: String(e.message || e) }, 500);
  }
}
