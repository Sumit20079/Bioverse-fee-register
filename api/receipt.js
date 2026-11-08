// The app calls this right after the teacher records a payment: the parent gets a "received" message on Telegram.
import { config, ok, ownerFromToken, sendReceipt } from './_lib.js';

export default async function handler(req, res) {
  const cfg = config();
  if (req.method !== 'POST') return ok(res, { error: 'POST only' }, 405);
  if (!cfg.supaUrl || !cfg.serviceKey || !cfg.botToken) return ok(res, { error: 'Not set up yet' }, 500);
  try {
    const owner = await ownerFromToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    if (!owner) return ok(res, { error: 'Not allowed' }, 401);
    const b = req.body || {};
    const sent = await sendReceipt(owner, String(b.student_id || ''), { amount: Number(b.amount), month: b.month, balance: Number(b.balance) || 0, paidOn: String(b.paid_on || '').slice(0, 40), batchName: String(b.batch || '').slice(0, 80) });
    return ok(res, { ok: true, sent });
  } catch (e) {
    return ok(res, { error: String(e.message || e) }, 500);
  }
}
