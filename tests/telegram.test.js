import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dueToday, headsUpOwner, remindOwner, summaryOwner } from '../api/_lib.js';
import handler from '../api/telegram.js';
import remind from '../api/remind.js';
import receipt from '../api/receipt.js';
import announce from '../api/announce.js';
import reply from '../api/reply.js';

const T = (date) => ({ today: date, day: Number(date.slice(8)) });

describe('when a reminder is due', () => {
  it('manual never goes out by itself', () => {
    expect(dueToday({ mode: 'manual', day: 28 }, T('2026-11-28'), null, false)).toBe(false);
  });
  it('once: only on the chosen day, and not twice', () => {
    const s = { mode: 'once', day: 28 };
    expect(dueToday(s, T('2026-11-27'), null, false)).toBe(false);
    expect(dueToday(s, T('2026-11-28'), null, false)).toBe(true);
    expect(dueToday(s, T('2026-11-28'), '2026-11-28', false)).toBe(false);
    expect(dueToday(s, T('2026-11-29'), '2026-11-28', false)).toBe(false);
  });
  it('repeat: from the chosen day, every N days', () => {
    const s = { mode: 'repeat', day: 28, every_days: 3 };
    expect(dueToday(s, T('2026-11-27'), null, false)).toBe(false);
    expect(dueToday(s, T('2026-11-28'), null, false)).toBe(true);
    expect(dueToday(s, T('2026-11-29'), '2026-11-28', false)).toBe(false);
    expect(dueToday(s, T('2026-11-30'), '2026-11-28', false)).toBe(false);
    expect(dueToday(s, T('2026-12-01'), '2026-11-28', false)).toBe(false); // before day 28 of the new month
  });
  it('send now ignores the schedule', () => {
    expect(dueToday({ mode: 'manual', day: 28 }, T('2026-11-03'), null, true)).toBe(true);
  });
});

// A tiny pretend Supabase + Telegram.
function world() {
  const month = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 7);
  const w = {
    sent: [],
    tables: {
      batches: [{ id: 'b1', owner_id: 'o1', name: 'Class 10', fee: 800, created_at: '1' }],
      students: [
        { id: 's1', owner_id: 'o1', batch_id: 'b1', name: 'Asha', joined_month: month + '-01', active: true, tg_token: 'tok1', created_at: '1' },
        { id: 's2', owner_id: 'o1', batch_id: 'b1', name: 'Bimal', joined_month: month + '-01', active: true, tg_token: 'tok2', created_at: '2' },
        { id: 's3', owner_id: 'o1', batch_id: 'b1', name: 'Chitra', joined_month: month + '-01', active: true, tg_token: 'tok3', created_at: '3' },
      ],
      payments: [{ id: 'p3', owner_id: 'o1', student_id: 's3', month: month + '-01', amount: 800, paid_on: month + '-02', settled: true, created_at: '1' }],
      parent_chats: [
        { id: 'c1', owner_id: 'o1', student_id: 's1', chat_id: 111 },
        { id: 'c3', owner_id: 'o1', student_id: 's3', chat_id: 333 }, // paid up: must not be messaged
      ],
      reminder_log: [],
      reminder_settings: [],
      parent_messages: [],
    },
    blocked: new Set(),
  };
  const parse = (url) => {
    const u = new URL(url);
    const table = u.pathname.split('/rest/v1/')[1];
    const f = [...u.searchParams.entries()].filter(([k]) => !['select', 'order', 'limit', 'on_conflict'].includes(k));
    return { table, f };
  };
  const match = (row, f) => f.every(([k, v]) => {
    const [op, ...r] = v.split('.');
    const val = r.join('.');
    if (op === 'eq') return String(row[k]) === val;
    if (op === 'neq') return String(row[k]) !== val;
    if (op === 'is') return val === 'null' ? row[k] == null : true;
    return true;
  });
  vi.stubGlobal('fetch', async (url, init = {}) => {
    const json = (b, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(b), json: async () => b });
    if (url.startsWith('https://api.telegram.org')) {
      const body = JSON.parse(init.body);
      if (url.endsWith('/sendMessage')) {
        if (w.blocked.has(body.chat_id)) return json({ ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' }, 403);
        w.sent.push({ chat: body.chat_id, text: body.text });
        return json({ ok: true });
      }
      return json({ ok: true, result: true });
    }
    if (url.includes('/auth/v1/user')) return json(init.headers.authorization === 'Bearer teacher-jwt' ? { id: 'o1' } : {}, init.headers.authorization === 'Bearer teacher-jwt' ? 200 : 401);
    const { table, f } = parse(url);
    const t = w.tables[table];
    if (init.method === 'GET') return json(t.filter((r) => match(r, f)));
    if (init.method === 'POST') {
      const row = { id: `${table}-${t.length + 1}`, sent_at: new Date().toISOString(), ...JSON.parse(init.body) }; // the database fills in id and sent_at
      const dup = table === 'parent_chats' && t.find((x) => x.student_id === row.student_id && x.chat_id === row.chat_id);
      if (!dup) t.push(row);
      return json([row]);
    }
    if (init.method === 'PATCH') {
      for (const r of t.filter((x) => match(x, f))) Object.assign(r, JSON.parse(init.body));
      return json([]);
    }
    if (init.method === 'DELETE') {
      w.tables[table] = t.filter((r) => !match(r, f));
      return json([]);
    }
    return json([]);
  });
  return w;
}

const res = () => {
  const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } };
  return r;
};

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://x.supabase.test';
  process.env.SUPABASE_SERVICE_KEY = 'svc';
  process.env.TELEGRAM_BOT_TOKEN = 'bot';
  process.env.TELEGRAM_WEBHOOK_SECRET = 'whsec';
  process.env.CRON_SECRET = 'cron';
});
afterEach(() => vi.unstubAllGlobals());

describe('sending reminders', () => {
  it('messages connected parents who owe money, and nobody else', async () => {
    const w = world();
    const out = await remindOwner('o1', { mode: 'manual', day: 28, every_days: 3, message: null }, { now: true });
    expect(out).toMatchObject({ sent: 1, failed: 0 });
    expect(w.sent).toHaveLength(1);
    expect(w.sent[0].chat).toBe(111);
    expect(w.sent[0].text).toMatch(/₹800.*Asha.*Class 10/);
  });
  it('not twice in one day', async () => {
    const w = world();
    const s = { mode: 'manual', day: 28, every_days: 3, message: null };
    await remindOwner('o1', s, { now: true });
    const again = await remindOwner('o1', s, { now: true });
    expect(again.sent).toBe(0);
    expect(w.sent).toHaveLength(1);
  });
  it('uses the teacher\'s own wording', async () => {
    const w = world();
    await remindOwner('o1', { mode: 'manual', day: 28, every_days: 3, message: 'Fee {amount} pending for {name}' }, { now: true });
    expect(w.sent[0].text).toBe('Fee ₹800 pending for Asha');
  });
  it('a parent who blocked the bot is forgotten', async () => {
    const w = world();
    w.blocked.add(111);
    const out = await remindOwner('o1', { mode: 'manual', day: 28, every_days: 3, message: null }, { now: true });
    expect(out.failed).toBe(1);
    expect(w.tables.parent_chats.find((c) => c.chat_id === 111)).toBeUndefined();
  });
  it('the timer only sends when the schedule says so', async () => {
    const w = world();
    const r = res();
    w.tables.reminder_settings.push({ owner_id: 'o1', mode: 'manual', day: 28, every_days: 3 });
    await remind({ headers: { authorization: 'Bearer cron' } }, r);
    expect(r.code).toBe(200);
    expect(w.sent).toHaveLength(0); // 'manual' rows are not even fetched
  });
  it('Send now needs the teacher to be logged in', async () => {
    const w = world();
    const bad = res();
    await remind({ headers: { authorization: 'Bearer nobody' } }, bad);
    expect(bad.code).toBe(401);
    const good = res();
    await remind({ headers: { authorization: 'Bearer teacher-jwt' } }, good);
    expect(good.body.sent).toBe(1);
    expect(w.sent).toHaveLength(1);
  });
});

describe('the Telegram webhook', () => {
  const hit = (w, text, chat = 777, secret = 'whsec') => {
    const r = res();
    return handler({ method: 'POST', headers: { 'x-telegram-bot-api-secret-token': secret }, body: { message: { text, chat: { id: chat }, from: { first_name: 'Parent' } } } }, r).then(() => r);
  };
  it('rejects calls that are not from Telegram', async () => {
    const w = world();
    expect((await hit(w, '/start tok2', 777, 'wrong')).code).toBe(401);
  });
  it('/start with a student\'s code connects the parent', async () => {
    const w = world();
    await hit(w, '/start tok2');
    expect(w.tables.parent_chats.find((c) => c.chat_id === 777)).toMatchObject({ student_id: 's2', owner_id: 'o1' });
    expect(w.sent.at(-1).text).toMatch(/Connected.*Bimal/);
  });
  it('connecting twice does not duplicate', async () => {
    const w = world();
    await hit(w, '/start tok2');
    await hit(w, '/start tok2');
    expect(w.tables.parent_chats.filter((c) => c.chat_id === 777)).toHaveLength(1);
  });
  it('an unknown code is refused politely', async () => {
    const w = world();
    await hit(w, '/start nonsense');
    expect(w.tables.parent_chats.find((c) => c.chat_id === 777)).toBeUndefined();
    expect(w.sent.at(-1).text).toMatch(/not valid/);
  });
  it('/stop removes the connection', async () => {
    const w = world();
    await hit(w, '/stop', 111);
    expect(w.tables.parent_chats.find((c) => c.chat_id === 111)).toBeUndefined();
  });
  it('the Stop button works like /stop', async () => {
    const w = world();
    await hit(w, '🔕 Stop reminders', 111);
    expect(w.tables.parent_chats.find((c) => c.chat_id === 111)).toBeUndefined();
  });
  it('/status shows what is pending', async () => {
    const w = world();
    await hit(w, '/status', 111);
    expect(w.sent.at(-1).text).toMatch(/Fee status for Asha[\s\S]*Pending:.*₹800/);
  });
  it('/status for a paid-up child says so and shows the last payment', async () => {
    const w = world();
    await hit(w, '📊 Status', 333);
    expect(w.sent.at(-1).text).toMatch(/Chitra[\s\S]*All paid up[\s\S]*Last payment: ₹800/);
  });
  it('/status from someone not connected asks them to connect', async () => {
    const w = world();
    await hit(w, '/status', 999);
    expect(w.sent.at(-1).text).toMatch(/not connected/);
  });
});

describe('payment receipts', () => {
  const post = (body, jwt = 'teacher-jwt') => {
    const r = res();
    return receipt({ method: 'POST', headers: { authorization: `Bearer ${jwt}` }, body }, r).then(() => r);
  };
  const month = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 7);
  it('tells the connected parent', async () => {
    const w = world();
    const r = await post({ student_id: 's3', amount: 800, month: month(), batch: 'Class 10', paid_on: '2 Nov 2026' });
    expect(r.body.sent).toBe(1);
    expect(w.sent[0]).toMatchObject({ chat: 333 });
    expect(w.sent[0].text).toMatch(/received the tuition fee of ₹800.*Chitra/);
  });
  it('needs the teacher to be logged in', async () => {
    const w = world();
    expect((await post({ student_id: 's3', amount: 800, month: month() }, 'nobody')).code).toBe(401);
    expect(w.sent).toHaveLength(0);
  });
  it('can be switched off', async () => {
    const w = world();
    w.tables.reminder_settings.push({ owner_id: 'o1', receipts: false });
    expect((await post({ student_id: 's3', amount: 800, month: month() })).body.sent).toBe(0);
    expect(w.sent).toHaveLength(0);
  });
  it('a waiver (₹0) sends nothing, and nobody else\'s student can be used', async () => {
    const w = world();
    expect((await post({ student_id: 's3', amount: 0, month: month() })).body.sent).toBe(0);
    w.tables.students.push({ id: 'x', owner_id: 'other', batch_id: 'b', name: 'X', joined_month: '2026-01-01', tg_token: 't' });
    w.tables.parent_chats.push({ id: 'cx', owner_id: 'other', student_id: 'x', chat_id: 5 });
    expect((await post({ student_id: 'x', amount: 500, month: month() })).body.sent).toBe(0);
    expect(w.sent).toHaveLength(0);
  });
});

describe('round 1 extras', () => {
  const hit = (text, chat) => {
    const r = res();
    return handler({ method: 'POST', headers: { 'x-telegram-bot-api-secret-token': 'whsec' }, body: { message: { text, chat: { id: chat }, from: { first_name: 'Parent' } } } }, r);
  };
  const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString();
  const S = (o) => ({ owner_id: 'o1', mode: 'once', day: 28, every_days: 3, warn_days: 0, summary: false, notify_connect: true, teacher_chat_id: null, ...o });

  it('/history lists paid months', async () => {
    const w = world();
    await hit('/history', 333);
    expect(w.sent.at(-1).text).toMatch(/Payment history for Chitra[\s\S]*₹800/);
  });
  it('/history with nothing paid says so', async () => {
    const w = world();
    await hit('🧾 History', 111);
    expect(w.sent.at(-1).text).toMatch(/No payments recorded yet for Asha/);
  });
  it('teacher connects with the private link', async () => {
    const w = world();
    w.tables.reminder_settings.push(S({ teacher_token: 'tchabc' }));
    await hit('/start tchabc', 900);
    expect(w.tables.reminder_settings[0].teacher_chat_id).toBe(900);
    expect(w.sent.at(-1).text).toMatch(/Connected as the teacher/);
  });
  it('a wrong teacher link connects nobody', async () => {
    const w = world();
    w.tables.reminder_settings.push(S({ teacher_token: 'tchabc' }));
    await hit('/start tchwrong', 900);
    expect(w.tables.reminder_settings[0].teacher_chat_id).toBe(null);
  });
  it('the teacher hears when a parent connects (if on)', async () => {
    const w = world();
    w.tables.reminder_settings.push(S({ teacher_chat_id: 900 }));
    await hit('/start tok2', 777);
    expect(w.sent.find((m) => m.chat === 900).text).toMatch(/connected on Telegram for Bimal/);
    w.sent.length = 0;
    w.tables.reminder_settings[0].notify_connect = false;
    await hit('/start tok2', 778);
    expect(w.sent.find((m) => m.chat === 900)).toBeUndefined();
  });
  const at = (iso) => (vi.isFakeTimers() ? vi.setSystemTime(new Date(iso)) : vi.useFakeTimers({ toFake: ['Date'], now: new Date(iso) }));
  afterEach(() => vi.useRealTimers());
  it('heads-up goes out only on the right day, only to this-month dues', async () => {
    const w = world(); // built at the real date; only Asha and Bimal owe
    at('2026-11-26T04:00:00Z'); // 26 Nov IST; reminder day 28, warn 2 days before
    w.tables.students.forEach((x) => (x.joined_month = '2026-11-01'));
    w.tables.payments.forEach((x) => (x.month = '2026-11-01'));
    expect((await headsUpOwner('o1', S({ warn_days: 3, day: 28 }))).sent).toBe(0); // wrong day
    const r = await headsUpOwner('o1', S({ warn_days: 2, day: 28 }));
    expect(r.sent).toBe(1);
    expect(w.sent[0]).toMatchObject({ chat: 111 });
    expect(w.sent[0].text).toMatch(/gentle heads-up.*Asha.*₹800/);
  });
  it('heads-up is off in manual mode or when set to 0', async () => {
    world();
    at('2026-11-26T04:00:00Z');
    expect((await headsUpOwner('o1', S({ mode: 'manual', warn_days: 2, day: 28 }))).sent).toBe(0);
    expect((await headsUpOwner('o1', S({ warn_days: 0, day: 26 }))).sent).toBe(0);
  });
  it('the monthly summary only goes on the 1st, to a connected teacher', async () => {
    const w = world();
    at('2026-12-01T04:00:00Z');
    const r = await summaryOwner('o1', S({ summary: true, teacher_chat_id: 900 }));
    expect(r.sent).toBe(1);
    expect(w.sent[0]).toMatchObject({ chat: 900 });
    expect(w.sent[0].text).toMatch(/Fee summary for November 2026[\s\S]*Collected/);
    at('2026-12-02T04:00:00Z');
    expect((await summaryOwner('o1', S({ summary: true, teacher_chat_id: 900 }))).sent).toBe(0);
    at('2026-12-01T04:00:00Z');
    expect((await summaryOwner('o1', S({ summary: true, teacher_chat_id: null }))).sent).toBe(0);
    expect((await summaryOwner('o1', S({ summary: false, teacher_chat_id: 900 }))).sent).toBe(0);
  });
  it('the timer runs everything for each teacher and survives one failing', async () => {
    const w = world();
    w.tables.reminder_settings.push(S({ mode: 'manual' }));
    const r = res();
    await remind({ headers: { authorization: 'Bearer cron' } }, r);
    expect(r.code).toBe(200);
    expect(r.body.teachers).toBe(1);
  });
});

describe('round 2: announcements and parent messages', () => {
  const call = (fn, body, jwt = 'teacher-jwt') => {
    const r = res();
    return fn({ method: 'POST', headers: { authorization: `Bearer ${jwt}` }, body }, r).then(() => r);
  };
  const talk = (text, chat, from = 'Mrs Paul') => {
    const r = res();
    return handler({ method: 'POST', headers: { 'x-telegram-bot-api-secret-token': 'whsec' }, body: { message: { text, chat: { id: chat }, from: { first_name: from } } } }, r);
  };

  it('an announcement reaches every connected parent', async () => {
    const w = world();
    const r = await call(announce, { text: 'No class on Saturday' });
    expect(r.body).toMatchObject({ sent: 2, failed: 0 });
    expect(w.sent.map((m) => m.chat).sort()).toEqual([111, 333]);
    expect(w.sent[0].text).toBe('📢 No class on Saturday');
  });
  it('one batch only', async () => {
    const w = world();
    w.tables.batches.push({ id: 'batch-two', owner_id: 'o1', name: 'Class 9', fee: 600, created_at: '2' });
    w.tables.students.find((s) => s.id === 's3').batch_id = 'batch-two';
    const r = await call(announce, { text: 'Hi class 9', batch_id: 'batch-two' });
    expect(r.body.sent).toBe(1);
    expect(w.sent[0].chat).toBe(333);
  });
  it('a parent with two children gets it once', async () => {
    const w = world();
    w.tables.parent_chats.push({ id: 'c9', owner_id: 'o1', student_id: 's2', chat_id: 111 });
    const r = await call(announce, { text: 'Holiday' });
    expect(w.sent.filter((m) => m.chat === 111)).toHaveLength(1);
    expect(r.body.sent).toBe(2);
  });
  it('needs the teacher, and an empty message sends nothing', async () => {
    const w = world();
    expect((await call(announce, { text: 'x' }, 'nobody')).code).toBe(401);
    expect((await call(announce, { text: '   ' })).body.sent).toBe(0);
    expect(w.sent).toHaveLength(0);
  });
  it('a parent\'s message is kept, acknowledged, and pinged to the teacher', async () => {
    const w = world();
    w.tables.reminder_settings.push({ owner_id: 'o1', teacher_chat_id: 900 });
    await talk('Can my son join the Sunday batch?', 111);
    expect(w.tables.parent_messages).toHaveLength(1);
    expect(w.tables.parent_messages[0]).toMatchObject({ direction: 'in', student_id: 's1', chat_id: 111, body: 'Can my son join the Sunday batch?' });
    expect(w.sent.find((m) => m.chat === 111).text).toMatch(/passed to the teacher/);
    expect(w.sent.find((m) => m.chat === 900).text).toMatch(/Mrs Paul \(Asha\)[\s\S]*Sunday batch/);
  });
  it('someone who is not connected just gets the help text', async () => {
    const w = world();
    await talk('hello?', 999);
    expect(w.tables.parent_messages).toHaveLength(0);
    expect(w.sent.at(-1).text).toMatch(/personal link/);
  });
  it('the teacher can reply, and only to a parent of theirs', async () => {
    const w = world();
    const ok1 = await call(reply, { chat_id: 111, student_id: 's1', text: 'Yes, come at 5' });
    expect(ok1.code).toBe(200);
    expect(w.sent.at(-1)).toMatchObject({ chat: 111 });
    expect(w.sent.at(-1).text).toMatch(/Yes, come at 5/);
    expect(w.tables.parent_messages.at(-1)).toMatchObject({ direction: 'out', read: true });
    const bad = await call(reply, { chat_id: 555, student_id: 's1', text: 'sneaky' });
    expect(bad.code).toBe(400);
    expect((await call(reply, { chat_id: 111, student_id: 's1', text: 'x' }, 'nobody')).code).toBe(401);
  });
});
