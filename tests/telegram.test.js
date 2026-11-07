import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dueToday, remindOwner } from '../api/_lib.js';
import handler from '../api/telegram.js';
import remind from '../api/remind.js';

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
});
