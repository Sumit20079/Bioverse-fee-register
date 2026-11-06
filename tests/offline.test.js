import { beforeEach, describe, expect, it } from 'vitest';
import { createSynced } from '../src/lib/offline';
import { makeLocal } from '../src/lib/db';

// A fake server: remembers its rows, and can be switched offline.
function fakeServer() {
  const s = { up: true, batches: [], students: [], payments: [], calls: [], refuse: null };
  const net = () => {
    if (!s.up) throw new Error('TypeError: Failed to fetch');
  };
  const upsert = (list, row) => {
    const i = list.findIndex((x) => x.id === row.id);
    if (i >= 0) list[i] = { ...list[i], ...row };
    else list.push({ ...row });
  };
  s.api = {
    async loadRaw() {
      net();
      return structuredClone({ batches: s.batches, students: s.students, payments: s.payments });
    },
    async backup() {
      net();
      return structuredClone({ batches: s.batches, students: s.students, payments: s.payments });
    },
    async saveBatch(b) { net(); s.calls.push('saveBatch'); upsert(s.batches, b); },
    async saveStudent(x) { net(); s.calls.push('saveStudent'); upsert(s.students, { ...x, joined_month: x.joined_month }); },
    async savePayment(p) {
      net();
      s.calls.push('savePayment');
      if (s.refuse) throw new Error(s.refuse);
      upsert(s.payments, p);
    },
    async removePayments(ids) { net(); s.calls.push('removePayments'); s.payments = s.payments.filter((p) => !ids.includes(p.id)); },
  };
  return s;
}

let n = 0;
const uid = () => `id${++n}`;
const memoryStore = () => {
  let v;
  return { get: async () => v, set: async (x) => { v = x; }, peek: () => v };
};

function setup(server, store = memoryStore(), online = { on: true }) {
  const sy = createSynced({ remote: server.api, makeLocal, store, uid, online: () => online.on });
  return { sy, store, online };
}
const view = async (sy) => sy.loadRaw();

describe('offline layer', () => {
  let server;
  beforeEach(() => {
    n = 0;
    server = fakeServer();
    server.batches.push({ id: 'b1', name: 'Class 11', fee: 1500 });
    server.students.push({ id: 's1', name: 'Asha', batch_id: 'b1', joined_month: '2026-10', active: true });
  });

  it('online: changes reach the server and come back from it', async () => {
    const { sy } = setup(server);
    await sy.loadRaw();
    await sy.savePayment({ student_id: 's1', month: '2026-11', amount: 1500, paid_on: '2026-11-02' });
    const raw = await view(sy);
    expect(server.payments).toHaveLength(1);
    expect(raw.payments[0].id).toBe(server.payments[0].id);
    expect(sy.sync.snapshot().pending).toBe(0);
  });

  it('offline: changes are kept on the device and shown straight away', async () => {
    const { sy, online } = setup(server);
    await sy.loadRaw();
    server.up = false; online.on = false;
    await sy.savePayment({ student_id: 's1', month: '2026-11', amount: 1000, paid_on: '2026-11-02' });
    const raw = await view(sy);
    expect(raw.payments).toHaveLength(1);
    expect(server.payments).toHaveLength(0);
    expect(sy.sync.snapshot()).toMatchObject({ pending: 1, online: false });
  });

  it('when the signal returns, waiting changes are sent in order and nothing is duplicated', async () => {
    const { sy, online } = setup(server);
    await sy.loadRaw();
    server.up = false; online.on = false;
    await sy.saveStudent({ name: 'New kid', batch_id: 'b1', joined_month: '2026-11' }); // created offline
    const kid = (await view(sy)).students.find((s) => s.name === 'New kid');
    await sy.savePayment({ student_id: kid.id, month: '2026-11', amount: 500, paid_on: '2026-11-03', settled: false });
    await sy.savePayment({ ...(await view(sy)).payments[0], amount: 700 }); // edit the offline payment
    server.up = true; online.on = true;
    const raw = await view(sy);
    expect(sy.sync.snapshot().pending).toBe(0);
    expect(server.students.filter((s) => s.name === 'New kid')).toHaveLength(1);
    expect(server.payments).toHaveLength(1);
    expect(server.payments[0]).toMatchObject({ student_id: kid.id, amount: 700 });
    expect(raw.payments).toHaveLength(1);
  });

  it('survives the app being closed while offline', async () => {
    const store = memoryStore();
    const a = setup(server, store);
    await a.sy.loadRaw();
    server.up = false; a.online.on = false;
    await a.sy.savePayment({ student_id: 's1', month: '2026-11', amount: 900, paid_on: '2026-11-02' });
    // reopen: a fresh layer on the same stored state, still offline
    const b = setup(server, store, { on: false });
    const raw = await b.sy.loadRaw();
    expect(raw.payments).toHaveLength(1);
    expect(b.sy.sync.snapshot().pending).toBe(1);
    // and later it goes up
    b.online.on = true; server.up = true;
    await b.sy.loadRaw();
    expect(server.payments).toHaveLength(1);
  });

  it('the server copy never overwrites changes that are still waiting', async () => {
    const { sy, online } = setup(server);
    await sy.loadRaw();
    await sy.savePayment({ student_id: 's1', month: '2026-11', amount: 100, paid_on: '2026-11-02' });
    // signal flickers: sending fails mid-way
    server.up = false;
    const raw = await view(sy);
    expect(raw.payments).toHaveLength(1);
    expect(sy.sync.snapshot().pending).toBe(1);
    void online;
  });

  it('a change the server refuses is dropped, reported, and does not block the rest', async () => {
    const { sy, online } = setup(server);
    await sy.loadRaw();
    server.up = false; online.on = false;
    await sy.savePayment({ student_id: 's1', month: '2026-11', amount: 100, paid_on: '2026-11-02' });
    await sy.saveBatch({ name: 'Class 12', fee: 2000 });
    server.up = true; online.on = true; server.refuse = 'violates foreign key constraint';
    await view(sy);
    const snap = sy.sync.snapshot();
    expect(snap.pending).toBe(0);
    expect(snap.error).toMatch(/foreign key/);
    expect(server.batches.map((b) => b.name)).toContain('Class 12');
  });

  it('last change wins: two devices edit the same payment', async () => {
    const A = setup(server);
    const B = setup(server);
    await A.sy.loadRaw();
    await B.sy.loadRaw();
    await A.sy.savePayment({ student_id: 's1', month: '2026-11', amount: 1500, paid_on: '2026-11-02' });
    await A.sy.loadRaw();
    const pid = server.payments[0].id;
    await B.sy.loadRaw();
    await A.sy.savePayment({ ...server.payments[0], amount: 1200 });
    await B.sy.savePayment({ ...server.payments[0], id: pid, amount: 1400 });
    await A.sy.loadRaw();
    await B.sy.loadRaw();
    expect(server.payments).toHaveLength(1);
    expect(server.payments[0].amount).toBe(1400);
  });

  it('with nothing saved on the device and no signal, it says so', async () => {
    server.up = false;
    const { sy } = setup(server, memoryStore(), { on: false });
    await expect(sy.loadRaw()).rejects.toThrow(/nothing saved on this device/);
  });

  it('signing out wipes the device copy', async () => {
    const { sy, store } = setup(server);
    await sy.loadRaw();
    await sy.sync.wipe();
    expect(store.peek().replica).toBeNull();
    expect(store.peek().outbox).toEqual([]);
  });
});
