// Offline-first layer. The register keeps a copy of the data on the device. Every change is applied to that
// copy straight away and also queued; the queue is sent to the server whenever it can be reached, in order.
// Clashes are settled by "the change that reaches the server last wins".

const clone = (x) => (x == null ? x : structuredClone(x));

export const WRITES = [
  'saveBatch',
  'saveStudent',
  'addStudents',
  'savePayment',
  'removePayments',
  'restore',
  'moveStudents',
  'deleteStudent',
  'deleteStudents',
  'deleteBatch',
  'restoreStudents',
  'restoreBatch',
  'purgeTrash',
  'restoreTrash',
  'purgeStudents',
  'purgeBatch',
];

// A request that never reached the server (no signal, DNS, captive portal), as opposed to the server saying no.
export function isNetworkError(e) {
  const msg = `${e?.message || e || ''} ${e?.details || ''}`;
  return /failed to fetch|fetch failed|network|load failed|timed out|timeout|offline|econn|enotfound/i.test(msg) || e?.status === 0;
}

// remote: the server backend ({loadRaw, backup, <writes>}); local: makeLocal over the device copy;
// store: {get(), set(state)} for the persisted {replica, outbox, syncedAt}; uid: id generator.
export function createSynced({ remote, makeLocal, store, uid, online = () => (typeof navigator === 'undefined' ? true : navigator.onLine) }) {
  let state = { replica: null, outbox: [], syncedAt: null };
  let reachable = true;
  let syncing = false;
  let lastError = '';
  let local = null;
  const listeners = new Set();

  const snapshot = () => ({
    online: online() && reachable,
    pending: state.outbox.length,
    syncing,
    syncedAt: state.syncedAt,
    error: lastError,
    hasCopy: !!state.replica,
  });
  const notify = () => listeners.forEach((f) => f(snapshot()));
  const persist = () => store.set(clone(state));

  const adopt = (replica) => {
    state.replica = replica;
    local = makeLocal({ read: () => state.replica, write: (d) => (state.replica = d) });
  };

  let readyP = null;
  const ready = () =>
    (readyP ||= (async () => {
      try {
        const saved = await store.get();
        if (saved) state = { replica: null, outbox: [], syncedAt: null, ...saved };
      } catch {
        /* no storage: online-only */
      }
      if (state.replica) adopt(state.replica);
      notify();
    })());

  // Give new rows their ids here, so a row created offline keeps the same id when it reaches the server.
  const prep = (m, args) => {
    const a = clone(args);
    if (m === 'saveBatch' || m === 'saveStudent') a[0] = { ...a[0], id: a[0].id || uid() };
    if (m === 'savePayment') a[0] = { ...a[0], id: a[0].id || uid() };
    if (m === 'addStudents') a[0] = a[0].map((s) => ({ ...s, id: s.id || uid() }));
    return a;
  };

  async function flush() {
    if (syncing) return;
    syncing = true;
    notify();
    try {
      while (state.outbox.length) {
        const op = state.outbox[0];
        try {
          await remote[op.m](...op.args);
          reachable = true;
        } catch (e) {
          if (isNetworkError(e)) {
            reachable = false;
            break;
          }
          // the server refused this change: drop it so it doesn't block the rest, and say so
          lastError = `A change could not be saved: ${e.message || e}`;
        }
        state.outbox.shift();
        await persist();
      }
    } finally {
      syncing = false;
      notify();
    }
  }

  const api = {
    // Returns {raw, fromDevice}. Sends waiting changes first, then refreshes the device copy from the server.
    async loadRaw() {
      await ready();
      if (state.outbox.length && online()) await flush();
      if (!state.outbox.length && online()) {
        try {
          const raw = await remote.loadRaw();
          reachable = true;
          adopt(raw);
          state.syncedAt = Date.now();
          await persist();
          notify();
          return raw;
        } catch (e) {
          if (!isNetworkError(e) || !state.replica) throw e;
          reachable = false;
          notify();
        }
      }
      if (!state.replica) throw new Error('No connection, and nothing saved on this device yet. Open the app once with internet.');
      notify();
      return clone(state.replica);
    },
    async backup() {
      await ready();
      if (online()) {
        try {
          return await remote.backup();
        } catch (e) {
          if (!isNetworkError(e) || !state.replica) throw e;
        }
      }
      return clone(state.replica);
    },
    flush,
    sync: {
      subscribe(f) {
        listeners.add(f);
        ready().then(() => f(snapshot()));
        return () => listeners.delete(f);
      },
      snapshot,
      clearError() {
        lastError = '';
        notify();
      },
      // sign-out: forget the device copy
      async wipe() {
        state = { replica: null, outbox: [], syncedAt: null };
        local = null;
        await persist();
        notify();
      },
    },
  };

  for (const m of WRITES) {
    api[m] = async (...args) => {
      await ready();
      if (!local) {
        // first write before any load (shouldn't happen): fall back to straight-through
        return remote[m](...args);
      }
      const a = prep(m, args);
      const result = await local[m](...a);
      state.outbox.push({ m, args: a });
      await persist();
      notify();
      return result;
    };
  }
  return api;
}
