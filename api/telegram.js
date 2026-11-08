// Telegram calls this when a parent messages the bot. "/start <code>" connects that parent to a student.
import { config, createClaim, db, historyText, keyboardForChat, ok, saveParentMessage, saveProof, sendTelegram, statusText, tg } from './_lib.js';
import { keyboardFor, langButtons, langOf, paidButton, T } from './_i18n.js';

const COMMANDS = [
  { command: 'status', description: 'See fee status' },
  { command: 'history', description: 'See past payments' },
  { command: 'language', description: 'Language / ভাষা' },
  { command: 'stop', description: 'Stop fee reminders' },
  { command: 'help', description: 'How this bot works' },
];

const needLink = (chatId) => sendTelegram(chatId, T('en').notConnected + '\n\n' + T('bn').notConnected);

export default async function handler(req, res) {
  const cfg = config();

  // One-time setup: open /api/telegram?setup=<CRON_SECRET> in a browser to point Telegram at this function.
  if (req.method === 'GET') {
    if (!cfg.cronSecret || req.query.setup !== cfg.cronSecret) return ok(res, { error: 'Not allowed' }, 401);
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const r = await fetch(`https://api.telegram.org/bot${cfg.botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: `https://${host}/api/telegram`, secret_token: cfg.webhookSecret, allowed_updates: ['message', 'callback_query'] }),
    });
    const cmds = await tg('setMyCommands', { commands: COMMANDS });
    return ok(res, { webhook: await r.json(), commands: cmds });
  }

  if (!cfg.webhookSecret || req.headers['x-telegram-bot-api-secret-token'] !== cfg.webhookSecret) return ok(res, { error: 'Not allowed' }, 401);
  try {
    // ---- taps on inline buttons (language, "I've paid") ----
    const cb = req.body?.callback_query;
    if (cb) {
      const chatId = cb.message?.chat?.id;
      const who = [cb.from?.first_name, cb.from?.last_name].filter(Boolean).join(' ');
      await tg('answerCallbackQuery', { callback_query_id: cb.id });
      const data = String(cb.data || '');
      if (chatId && data.startsWith('lang:')) {
        const lang = data === 'lang:bn' ? 'bn' : 'en';
        await db('PATCH', `parent_chats?chat_id=eq.${chatId}`, { lang });
        await sendTelegram(chatId, T(lang).langSet, keyboardFor(lang));
      } else if (chatId && data.startsWith('paid:')) {
        const studentId = data.slice(5);
        const [link] = await db('GET', `parent_chats?select=*&chat_id=eq.${chatId}&student_id=eq.${studentId}`);
        if (link) {
          const L = T(langOf(link));
          const { claim } = await createClaim(link, who);
          await sendTelegram(chatId, claim ? L.paidThanks : L.nothingDue, keyboardForChat(link));
        }
      }
      return ok(res);
    }

    const msg = req.body?.message;
    if (!msg) return ok(res);
    const chatId = msg.chat.id;
    const who = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ');

    // ---- a screenshot (photo, or an image sent as a file) ----
    const fileId = msg.photo?.length ? msg.photo[msg.photo.length - 1].file_id : /^image\//.test(msg.document?.mime_type || '') ? msg.document.file_id : null;
    if (fileId) {
      const links = await db('GET', `parent_chats?select=*&chat_id=eq.${chatId}`);
      if (!links.length) {
        await needLink(chatId);
        return ok(res);
      }
      // with two children the screenshot goes to the one that owes, else the first
      const L = T(langOf(links[0]));
      let made = null;
      for (const l of links) {
        made = await createClaim(l, who);
        if (made.claim) break;
      }
      if (!made?.claim) {
        await sendTelegram(chatId, L.nothingDue, keyboardForChat(links[0]));
        return ok(res);
      }
      const saved = await saveProof(made.claim, fileId);
      await sendTelegram(chatId, saved ? L.gotShot : L.paidThanks, keyboardForChat(links[0]));
      return ok(res);
    }

    if (!msg.text) return ok(res);
    const text = msg.text.trim();

    if (/^\/stop\b/i.test(text) || /^🔕/.test(text)) {
      const [link] = await db('GET', `parent_chats?select=lang&chat_id=eq.${chatId}`);
      await db('DELETE', `parent_chats?chat_id=eq.${chatId}`);
      await sendTelegram(chatId, T(langOf(link)).stopped);
      return ok(res);
    }
    if (/^\/language\b/i.test(text)) {
      await sendTelegram(chatId, T('en').chooseLang, langButtons());
      return ok(res);
    }
    if (/^\/status\b/i.test(text) || /^📊/.test(text)) {
      const chats = await db('GET', `parent_chats?select=*&chat_id=eq.${chatId}`);
      if (!chats.length) await needLink(chatId);
      for (const c of chats) await sendTelegram(chatId, await statusText(c), keyboardForChat(c));
      return ok(res);
    }
    if (/^\/history\b/i.test(text) || /^🧾/.test(text)) {
      const chats = await db('GET', `parent_chats?select=*&chat_id=eq.${chatId}`);
      if (!chats.length) await needLink(chatId);
      for (const c of chats) await sendTelegram(chatId, await historyText(c), keyboardForChat(c));
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
      await sendTelegram(chatId, 'Connected as the teacher. You will get updates here: when a parent connects, parent messages, payment claims, and the monthly fee summary if you turned it on in the app.');
      return ok(res);
    }
    if (m && m[1]) {
      const [student] = await db('GET', `students?select=id,name,owner_id&tg_token=eq.${m[1]}&deleted_at=is.null`);
      if (!student) {
        await sendTelegram(chatId, T('en').invalid + '\n\n' + T('bn').invalid);
        return ok(res);
      }
      await db('POST', 'parent_chats?on_conflict=student_id,chat_id', { owner_id: student.owner_id, student_id: student.id, chat_id: chatId, chat_name: who }, { prefer: 'resolution=merge-duplicates,return=minimal' });
      const [cfgRow] = await db('GET', `reminder_settings?select=teacher_chat_id,notify_connect&owner_id=eq.${student.owner_id}`);
      if (cfgRow?.teacher_chat_id && cfgRow.notify_connect !== false) await sendTelegram(cfgRow.teacher_chat_id, `${who || 'A parent'} connected on Telegram for ${student.name}.`);
      const [link] = await db('GET', `parent_chats?select=lang&chat_id=eq.${chatId}&student_id=eq.${student.id}`);
      await sendTelegram(chatId, T(langOf(link)).connected(student.name), keyboardFor(langOf(link)));
      await sendTelegram(chatId, T('en').chooseLang, langButtons());
      return ok(res);
    }
    if (!text.startsWith('/')) {
      const links = await db('GET', `parent_chats?select=*&chat_id=eq.${chatId}`);
      if (links.length) {
        await saveParentMessage(links, text, who);
        await sendTelegram(chatId, T(langOf(links[0])).thanks, keyboardForChat(links[0]));
        return ok(res);
      }
    }
    const [any] = await db('GET', `parent_chats?select=lang&chat_id=eq.${chatId}`);
    await sendTelegram(chatId, T(langOf(any)).help);
  } catch {
    /* always answer 200 so Telegram doesn't retry the same message forever */
  }
  return ok(res);
}
