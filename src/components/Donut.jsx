// Collected vs still-pending as a ring. Purely visual; the numbers sit beside it.
export default function Donut({ collected, pending, size = 116 }) {
  const total = collected + pending;
  const r = 46;
  const circumference = 2 * Math.PI * r;
  const share = total > 0 ? collected / total : 0;
  const pct = Math.round(share * 100);

  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" role="img" aria-label={total > 0 ? `${pct}% of fees collected` : 'No fees expected yet'}>
        <circle className="donut-track" cx="60" cy="60" r={r} fill="none" strokeWidth="14" />
        <circle
          className="donut-fill"
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="14"
          strokeLinecap={share > 0 ? 'round' : 'butt'}
          strokeDasharray={`${share * circumference} ${circumference}`}
          transform="rotate(-90 60 60)"
          style={{ '--c': circumference }}
        />
      </svg>
      <div className="donut-label">
        <b>{total > 0 ? `${pct}%` : '–'}</b>
        <span>collected</span>
      </div>
    </div>
  );
}
