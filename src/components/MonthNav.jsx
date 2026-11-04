import { Icon } from './Icons';
import { addMonths, currentMonth } from '../lib/dates';

// Pressing an arrow makes the whole button lean the way it points and spring back.
function lean(el, dir) {
  if (!el?.animate || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  const d = dir * 9;
  el.animate(
    [
      { transform: 'translateX(0) scale(1)' },
      { transform: `translateX(${d}px) scale(0.92)`, offset: 0.3 },
      { transform: `translateX(${-d * 0.35}px) scale(1.04)`, offset: 0.65 },
      { transform: 'translateX(0) scale(1)' },
    ],
    { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  );
}

export default function MonthNav({ month, onChange, animate = false }) {
  return (
    <div className="navpair">
      <button
        className="iconbtn"
        aria-label="Previous month"
        onClick={(e) => {
          if (animate) lean(e.currentTarget, -1);
          onChange(addMonths(month, -1));
        }}
      >
        <Icon.Left />
      </button>
      <button
        className="iconbtn"
        aria-label="Next month"
        disabled={month >= currentMonth()}
        onClick={(e) => {
          if (animate) lean(e.currentTarget, 1);
          onChange(addMonths(month, 1));
        }}
      >
        <Icon.Right />
      </button>
    </div>
  );
}
