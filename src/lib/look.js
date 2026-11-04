import { ACCENTS } from './accents';

// Per-device look: accent colour + outlines. Stored in localStorage, applied as CSS variables.
const KEY = 'fee-register-look-v1';
export const DEFAULT_LOOK = { accent: 'green', outlines: false };

export function loadLook() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { accent: ACCENTS.some((a) => a.id === v.accent) ? v.accent : DEFAULT_LOOK.accent, outlines: !!v.outlines };
  } catch {
    return { ...DEFAULT_LOOK };
  }
}

export function applyLook(look) {
  const a = ACCENTS.find((x) => x.id === look.accent) || ACCENTS[0];
  const r = document.documentElement;
  const set = {
    '--bg': a.bg, '--card': a.card, '--ink': a.text, '--muted': a.muted, '--line': a.line, '--field': a.field,
    '--primary': a.primary, '--primary-tint': a.tint, '--primary-ink': a.ink, '--neutral-fill': a.fill,
    '--amber-tint': a.due.tint, '--amber-ink': a.due.ink, '--amber-dark': a.due.dark,
  };
  for (const [k, v] of Object.entries(set)) r.style.setProperty(k, v);
  r.classList.toggle('outlines', !!look.outlines);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', a.primary);
}

export function saveLook(look) {
  try {
    localStorage.setItem(KEY, JSON.stringify(look));
  } catch {
    /* private mode etc: the look just won't be remembered */
  }
}
