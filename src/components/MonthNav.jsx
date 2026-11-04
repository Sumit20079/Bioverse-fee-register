import { Icon } from './Icons';
import { addMonths, currentMonth } from '../lib/dates';

import { lean } from '../lib/lean';

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
