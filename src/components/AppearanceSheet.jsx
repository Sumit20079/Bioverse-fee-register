import { ACCENTS } from '../lib/accents';
import { seedOf } from '../lib/look';
import { Icon } from './Icons';
import { useEffect, useRef, useState } from 'react';
import Sheet from './Sheet';
import ColorWheel from './ColorWheel';

const MODES = [
  ['system', 'System', Icon.Phone],
  ['light', 'Light', Icon.Sun],
  ['dark', 'Dark', Icon.Moon],
];
const STYLES = [
  ['standard', 'Standard', Icon.Palette],
  ['you', 'Material You', Icon.Sparkle],
  ['mono', 'Monochrome', Icon.Contrast],
];

function Seg({ label, items, value, onPick }) {
  return (
    <div className="field">
      <span className="lbl">{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {items.map(([id, name, Ico]) => (
          <button key={id} type="button" role="radio" aria-checked={value === id} className={value === id ? 'on' : ''} onClick={() => onPick(id)}>
            <Ico /> {name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AppearanceSheet({ look, onChange, onClose }) {
  const mono = look.style === 'mono';
  const [picking, setPicking] = useState(look.accent === 'custom');
  const panel = useRef(null);
  // when the wheel opens, bring it fully into view once the panel has grown
  useEffect(() => {
    if (!picking) return undefined;
    const t = setTimeout(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 280);
    return () => clearTimeout(t);
  }, [picking]);
  return (
    <Sheet title="Appearance" subtitle="Saved on this device only" onClose={onClose}>
      <Seg label="Theme mode" items={MODES} value={look.mode} onPick={(mode) => onChange({ ...look, mode })} />
      <Seg label="Colour style" items={STYLES} value={look.style} onPick={(style) => onChange({ ...look, style })} />

      <div className="field" style={mono ? { opacity: 0.45 } : undefined}>
        <span className="lbl">Accent colour{mono ? ' (not used in Monochrome)' : ''}</span>
        <div className="swatches" role="radiogroup" aria-label="Accent colour">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={look.accent === a.id}
              aria-label={a.name}
              title={a.name}
              className={'swatch' + (look.accent === a.id ? ' on' : '')}
              style={{ '--sw': a.swatch }}
              onClick={() => onChange({ ...look, accent: a.id })}
            >
              {look.accent === a.id && <Tick />}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={look.accent === 'custom'}
            aria-expanded={picking}
            aria-label="Pick any colour"
            title="Pick any colour"
            className={'swatch pick' + (look.accent === 'custom' ? ' on' : '')}
            style={{ '--sw': look.custom }}
            onClick={() => {
              setPicking((v) => !v);
              if (look.accent !== 'custom') onChange({ ...look, accent: 'custom' });
            }}
          >
            {look.accent === 'custom' ? <Tick /> : <Icon.Pipette />}
          </button>
        </div>
        <div ref={panel} className={'collapse' + (picking ? ' open' : '')} aria-hidden={!picking}>
          <div className="collapse-in">
            <ColorWheel value={look.custom} onChange={(custom) => onChange({ ...look, accent: 'custom', custom })} />
          </div>
        </div>
      </div>

      <label className="switchrow">
        <span>
          <b>Outlines</b>
          <small>Draws a thin edge around cards, panels and buttons</small>
        </span>
        <input type="checkbox" role="switch" checked={look.outlines} onChange={(e) => onChange({ ...look, outlines: e.target.checked })} />
      </label>
      <button className="btn" onClick={onClose}>Done</button>
    </Sheet>
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
