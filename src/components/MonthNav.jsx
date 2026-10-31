import { Icon } from './Icons';
import { addMonths, currentMonth } from '../lib/dates';

export default function MonthNav({ month, onChange }) {
  return (
    <div className="navpair">
      <button className="iconbtn" aria-label="Previous month" onClick={() => onChange(addMonths(month, -1))}>
        <Icon.Left />
      </button>
      <button
        className="iconbtn"
        aria-label="Next month"
        disabled={month >= currentMonth()}
        onClick={() => onChange(addMonths(month, 1))}
      >
        <Icon.Right />
      </button>
    </div>
  );
}
