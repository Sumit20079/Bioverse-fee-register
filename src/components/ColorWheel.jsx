import { useEffect, useRef, useState } from 'react';

// hex <-> hsv (h 0-360, s 0-1, v 0-1)
export function hexToHsv(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: max ? d / max : 0, v: max };
}
export function hsvToHex({ h, s, v }) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return '#' + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
export function parseHex(text) {
  let t = text.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(t)) t = t.split('').map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/i.test(t) ? '#' + t.toLowerCase() : null;
}

export default function ColorWheel({ value, onChange }) {
  const wheel = useRef(null);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [text, setText] = useState(value.toUpperCase());
  const drag = useRef(false);

  // follow outside changes (e.g. a swatch was tapped) without fighting our own updates
  useEffect(() => {
    if (hsvToHex(hsv) !== value.toLowerCase()) {
      setHsv(hexToHsv(value));
    }
    setText(value.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const push = (next) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setText(hex.toUpperCase());
    onChange(hex);
  };

  const pick = (e) => {
    const r = wheel.current.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    const rad = r.width / 2;
    const dist = Math.min(Math.hypot(x, y), rad);
    const h = ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360; // 0° at the top, clockwise
    push({ h, s: dist / rad, v: hsv.v || 1 });
  };
  const down = (e) => { drag.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); pick(e); };
  const move = (e) => drag.current && pick(e);
  const up = () => { drag.current = false; };

  const a = ((hsv.h - 90) * Math.PI) / 180;
  const tx = 50 + Math.cos(a) * hsv.s * 50, ty = 50 + Math.sin(a) * hsv.s * 50;
  const full = hsvToHex({ h: hsv.h, s: hsv.s, v: 1 });

  const onText = (e) => {
    const t = e.target.value;
    setText(t);
    const hex = parseHex(t);
    if (hex) {
      setHsv(hexToHsv(hex));
      onChange(hex);
    }
  };

  return (
    <div className="wheelbox">
      <div className="wheelwrap">
      <div
        ref={wheel}
        className="wheel"
        style={{ filter: `brightness(${0.25 + 0.75 * hsv.v})` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        role="slider"
        aria-label="Colour wheel"
        aria-valuetext={hsvToHex(hsv)}
        tabIndex={0}
      />
      <div className="wheel-thumb" style={{ left: `${tx}%`, top: `${ty}%`, background: hsvToHex(hsv) }} />
      </div>
      <label className="field">
        <span className="lbl">Brightness</span>
        <input
          type="range"
          className="bright"
          min="0.05"
          max="1"
          step="0.01"
          value={hsv.v}
          style={{ background: `linear-gradient(90deg, #000, ${full})` }}
          onChange={(e) => push({ ...hsv, v: Number(e.target.value) })}
        />
      </label>
      <label className="field hexfield">
        <span className="lbl">Hex colour</span>
        <div className="hexrow">
          <i style={{ background: hsvToHex(hsv) }} />
          <input
            value={text}
            onChange={onText}
            onBlur={() => setText(hsvToHex(hsv).toUpperCase())}
            maxLength={7}
            spellCheck="false"
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            placeholder="#2E7D4F"
            aria-label="Hex colour"
          />
        </div>
      </label>
    </div>
  );
}
