// The teacher answers a parent's message from the app.
import { config, ok, ownerFromToken, replyOwner } from './_lib.js';

export default async function handler(req, res) {
  const cfg = config();
  if (req.method !== 'POST') return ok(res, { error: 'POST only' }, 405);
  if (!cfg.supaUrl || !cfg.serviceKey || !cfg.botToken) return ok(res, { error: 'Not set up yet' }, 500);
  try {
    const owner = await ownerFromToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    if (!owner) return ok(res, { error: 'Not allowed' }, 401);
    const b = req.body || {};
    const r = await replyOwner(owner, { chatId: b.chat_id, studentId: String(b.student_id || ''), text: b.text });
    return ok(res, { ok: r.sent, ...r }, r.sent ? 200 : 400);
  } catch (e) {
    return ok(res, { error: String(e.message || e) }, 500);
  }
}
