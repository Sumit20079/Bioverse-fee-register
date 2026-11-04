import { argbFromHex, hexFromArgb, themeFromSourceColor, TonalPalette, Hct } from '@material/material-color-utilities';
import { ACCENTS } from './accents';

// Per-device look, saved in localStorage and applied as CSS variables on <html>.
//   mode:    system | light | dark
//   style:   standard | you (Material You) | mono (Monochrome)
//   accent:  an id from ACCENTS, or 'custom' (uses `custom`, a #hex from the colour picker)
const KEY = 'fee-register-look-v2';
export const DEFAULT_LOOK = { mode: 'light', style: 'standard', accent: 'green', custom: '#6750a4', outlines: false };

const HEX = /^#[0-9a-f]{6}$/i;

export function loadLook() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      mode: ['system', 'light', 'dark'].includes(v.mode) ? v.mode : DEFAULT_LOOK.mode,
      style: ['standard', 'you', 'mono'].includes(v.style) ? v.style : DEFAULT_LOOK.style,
      accent: v.accent === 'custom' || ACCENTS.some((a) => a.id === v.accent) ? v.accent : DEFAULT_LOOK.accent,
      custom: HEX.test(v.custom || '') ? v.custom : DEFAULT_LOOK.custom,
      outlines: !!v.outlines,
    };
  } catch {
    return { ...DEFAULT_LOOK };
  }
}

export function saveLook(look) {
  try {
    localStorage.setItem(KEY, JSON.stringify(look));
  } catch {
    /* private mode etc: the look just won't be remembered */
  }
}

export const seedOf = (look) => (look.accent === 'custom' ? look.custom : (ACCENTS.find((a) => a.id === look.accent) || ACCENTS[0]).swatch);

const GREY = TonalPalette.fromHueAndChroma(0, 0);

export function tokens(look, dark) {
  const seed = seedOf(look);
  const argb = argbFromHex(seed);
  const P = themeFromSourceColor(argb).palettes;
  const h = (a) => hexFromArgb(a);
  const hue = Hct.fromInt(argb).hue;
  const warm = look.style !== 'mono' && ((hue >= 5 && hue <= 95) || hue >= 350); // red, orange, yellow, brown
  const mono = look.style === 'mono';
  const pri = mono ? GREY : P.primary;
  const neu = mono ? GREY : P.neutral;
  const nv = mono ? GREY : P.neutralVariant;
  // Material You: the big cards and selected states use the tertiary hue for a livelier look
  const acc = look.style === 'you' ? P.tertiary : pri;
  let t;
  if (!dark) {
    t = {
      primary: pri.tone(mono ? 30 : 40), onPrimary: '#ffffff',
      tint: h(acc.tone(90)), ink: h(acc.tone(10)),
      bg: h(neu.tone(98)), card: h(look.style === 'you' ? nv.tone(94) : neu.tone(95)), fill: h(nv.tone(90)),
      line: h(nv.tone(86)), field: h(nv.tone(60)), text: h(neu.tone(10)), muted: h(nv.tone(30)),
      inv: h(neu.tone(20)), onInv: '#ffffff', danger: '#b42318',
      due: warm ? ['#e8def8', '#5b3fa0', '#22104f'] : ['#ffddb8', '#9a5200', '#3d2000'], onDue: '#ffffff',
    };
    t.primary = h(t.primary);
    if (look.style === 'standard' && look.accent === 'green') Object.assign(t, { primary: '#2e7d4f', tint: '#cdebd6', ink: '#073b1f', bg: '#f5faf6', card: '#eef5f0', fill: '#dde7e0', line: '#d3ded7', field: '#8f9d96', text: '#1a1f1d', muted: '#47524d', inv: '#1a1f1d' });
  } else {
    t = {
      primary: h(pri.tone(80)), onPrimary: h(pri.tone(20)),
      tint: h(acc.tone(30)), ink: h(acc.tone(90)),
      bg: h(neu.tone(6)), card: h(look.style === 'you' ? nv.tone(17) : neu.tone(12)), fill: h(nv.tone(24)),
      line: h(nv.tone(30)), field: h(nv.tone(60)), text: h(neu.tone(90)), muted: h(nv.tone(80)),
      inv: h(neu.tone(90)), onInv: h(neu.tone(20)), danger: '#ffb4ab',
      due: warm ? ['#3d2d66', '#d0bcff', '#e8def8'] : ['#4a2e08', '#ffb566', '#ffdcb8'], onDue: '#3d2000',
    };
  }
  return t;
}

export function applyLook(look) {
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  const dark = look.mode === 'dark' || (look.mode === 'system' && !!mq?.matches);
  const t = tokens(look, dark);
  const r = document.documentElement;
  const set = {
    '--bg': t.bg, '--card': t.card, '--ink': t.text, '--muted': t.muted, '--line': t.line, '--field': t.field,
    '--primary': t.primary, '--on-primary': t.onPrimary, '--primary-tint': t.tint, '--primary-ink': t.ink, '--neutral-fill': t.fill,
    '--inv': t.inv, '--on-inv': t.onInv, '--danger': t.danger,
    '--amber-tint': t.due[0], '--amber-ink': t.due[1], '--amber-dark': t.due[2], '--on-due': t.onDue,
  };
  for (const [k, v] of Object.entries(set)) r.style.setProperty(k, v);
  r.style.colorScheme = dark ? 'dark' : 'light';
  r.classList.toggle('outlines', !!look.outlines);
  r.classList.toggle('dark', dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t.bg);
}

// Follow the phone's light/dark switch live while mode is "system".
export function watchSystem(getLook) {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const on = () => getLook().mode === 'system' && applyLook(getLook());
  mq.addEventListener?.('change', on);
  return () => mq.removeEventListener?.('change', on);
}
