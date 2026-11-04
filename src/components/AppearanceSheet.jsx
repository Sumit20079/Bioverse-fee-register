import { ACCENTS } from '../lib/accents';
import Sheet from './Sheet';

export default function AppearanceSheet({ look, onChange, onClose }) {
  return (
    <Sheet title="Appearance" subtitle="Saved on this device only" onClose={onClose}>
      <div className="field">
        <span className="lbl">Accent colour</span>
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
              {look.accent === a.id && (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </button>
          ))}
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
