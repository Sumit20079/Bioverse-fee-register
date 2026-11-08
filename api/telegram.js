// Telegram calls this when a parent messages the bot. "/start <code>" connects that parent to a student.
import { config, db, historyText, KEYBOARD, ok, sendTelegram, statusText } from './_lib.js';

const HELP =
  'Hello! This bot sends tuition fee reminders. To connect, open the personal link your teacher sent you and press Start. ' +
  'Send /status for the fee status, /history for past payments, or /stop to stop the reminders.';

const COMMANDS = [
  { command: 'status', description: 'See fee status' },
  { command: 'history', description: 'See past payments' },
  { command: 'stop', description: 'Stop fee reminders' },
  { command: 'help', description: 'How this bot works' },
];

export default async function handler(req, res) {
  const cfg = config();

  // One-time setup: open /api/telegram?setup=<CRON_SECRET> in a browser to point Telegram at this function.
  if (req.method === 'GET') {
    if (!cfg.cronSecret || req.query.setup !== cfg.cronSecret) return ok(res, { error: 'Not allowed' }, 401);
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const r = await fetch(`https://api.telegram.org/bot${cfg.botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: `https://${host}/api/telegram`, secret_token: cfg.webhookSecret, allowed_updates: ['message'] }),
    });
    const cmds = await fetch(`https://api.telegram.org/bot${cfg.botToken}/setMyCommands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ commands: COMMANDS }),
    });
    return ok(res, { webhook: await r.json(), commands: await cmds.json() });
  }

  if (!cfg.webhookSecret || req.headers['x-telegram-bot-api-secret-token'] !== cfg.webhookSecret) return ok(res, { error: 'Not allowed' }, 401);
  try {
    const msg = req.body?.message;
    if (!msg?.text) return ok(res);
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const who = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ');

    if (/^\/stop\b/i.test(text) || /^🔕/.test(text)) {
      await db('DELETE', `parent_chats?chat_id=eq.${chatId}`);
      await sendTelegram(chatId, 'Okay, you will not get fee reminders any more. Open your teacher\'s link again any time to reconnect.');
      return ok(res);
    }
    if (/^\/status\b/i.test(text) || /^📊/.test(text)) {
      const chats = await db('GET', `parent_chats?select=*&chat_id=eq.${chatId}`);
      if (!chats.length) await sendTelegram(chatId, 'You are not connected yet. Open the personal link your teacher sent you and press Start.');
      for (const c of chats) await sendTelegram(chatId, await statusText(c), KEYBOARD);
      return ok(res);
    }
    if (/^\/history\b/i.test(text) || /^🧾/.test(text)) {
      const chats = await db('GET', `parent_chats?select=*&chat_id=eq.${chatId}`);
      if (!chats.length) await sendTelegram(chatId, 'You are not connected yet. Open the personal link your teacher sent you and press Start.');
      for (const c of chats) await sendTelegram(chatId, await historyText(c), KEYBOARD);
      return ok(res);
    }
    const m = text.match(/^\/start(?:\s+(\w+))?/i);
    if (m && m[1] && m[1].startsWith('tch')) {
      const [row] = await db('GET', `reminder_settings?select=owner_id&teacher_token=eq.${m[1]}`);
      if (!row) {
        await sendTelegram(chatId, 'This link is not valid any more. Open Settings → Telegram reminders in the app for a fresh one.');
        return ok(res);
      }
      await db('PATCH', `reminder_settings?owner_id=eq.${row.owner_id}`, { teacher_chat_id: chatId });
      await sendTelegram(chatId, 'Connected as the teacher. You will get updates here: when a parent connects, and the monthly fee summary if you turned it on in the app.');
      return ok(res);
    }
    if (m && m[1]) {
      const [student] = await db('GET', `students?select=id,name,owner_id&tg_token=eq.${m[1]}&deleted_at=is.null`);
      if (!student) {
        await sendTelegram(chatId, 'This link is not valid any more. Please ask your teacher for a new one.');
        return ok(res);
      }
      await db('POST', 'parent_chats?on_conflict=student_id,chat_id', { owner_id: student.owner_id, student_id: student.id, chat_id: chatId, chat_name: who }, { prefer: 'resolution=merge-duplicates,return=minimal' });
      const [cfgRow] = await db('GET', `reminder_settings?select=teacher_chat_id,notify_connect&owner_id=eq.${student.owner_id}`);
      if (cfgRow?.teacher_chat_id && cfgRow.notify_connect !== false) await sendTelegram(cfgRow.teacher_chat_id, `${who || 'A parent'} connected on Telegram for ${student.name}.`);
      await sendTelegram(chatId, `Connected. You will get tuition fee reminders for ${student.name} here. Send /status any time to see the fee status, or /stop to stop reminders.`, KEYBOARD);
      return ok(res);
    }
    await sendTelegram(chatId, HELP);
  } catch {
    /* always answer 200 so Telegram doesn't retry the same message forever */
  }
  return ok(res);
}
