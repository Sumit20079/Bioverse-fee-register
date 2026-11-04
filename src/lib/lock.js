// Optional PIN lock, kept on this device only. A casual lock: it stops someone who picks up an
// unlocked phone, it is not protection against someone who can open the browser's developer tools.
const KEY = 'fee-register-lock-v1';
export const DELAYS = [
  [0, 'Right away'],
  [1, '1 minute'],
  [5, '5 minutes'],
];

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');

async function derive(pin, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return hex(bits);
}

export function loadLock() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && v.hash && v.salt) return { hash: v.hash, salt: v.salt, delay: [0, 1, 5].includes(v.delay) ? v.delay : 1, fails: v.fails || 0, until: v.until || 0 };
  } catch {
    /* unreadable: treat as no lock */
  }
  return null;
}

function save(v) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage blocked: the lock just won't stick */
  }
}

export async function setPin(pin, delay = 1) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(12)));
  save({ salt, hash: await derive(pin, salt), delay, fails: 0, until: 0 });
}

export function setDelay(delay) {
  const v = loadLock();
  if (v) save({ ...v, delay });
}

export function clearLock() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

// Returns { ok } or { ok:false, wait } (seconds to wait) or { ok:false, left } (tries before a wait kicks in).
export async function verifyPin(pin) {
  const v = loadLock();
  if (!v) return { ok: true };
  const now = Date.now();
  if (v.until > now) return { ok: false, wait: Math.ceil((v.until - now) / 1000) };
  if ((await derive(pin, v.salt)) === v.hash) {
    save({ ...v, fails: 0, until: 0 });
    return { ok: true };
  }
  const fails = v.fails + 1;
  const wait = fails >= 5 ? Math.min(30 * 2 ** (Math.floor(fails / 5) - 1), 600) : 0;
  save({ ...v, fails, until: wait ? now + wait * 1000 : 0 });
  return wait ? { ok: false, wait } : { ok: false, left: 5 - fails };
}

export const delayLabel = (d) => (d === 0 ? 'right away' : d === 1 ? 'after 1 minute away' : `after ${d} minutes away`);
