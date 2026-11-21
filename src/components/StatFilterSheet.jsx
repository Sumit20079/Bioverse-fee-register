import Sheet from './Sheet';
import { STAT_FILTERS } from '../lib/admissions';

// Pick any number of values for one filter. Applicants matching any of them stay in; filters in different groups combine.
export default function StatFilterSheet({ filterKey, selected, counts, onToggle, onClearOne, onClose }) {
  const f = STAT_FILTERS[filterKey];
  return (
    <Sheet title={f.label} subtitle="Pick one or more. The table updates as you tap." onClose={onClose}>
      <div className="adm-seg" role="group" aria-label={f.label}>
        {f.options.map((o) => (
          <button key={o} type="button" className={'chip' + (selected.includes(o) ? ' on' : '')} aria-pressed={selected.includes(o)} onClick={() => onToggle(o)}>
            {o}
            <span className="st-n">{counts[o] || 0}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn" onClick={onClose}>
        Done
      </button>
      {selected.length > 0 && (
        <button type="button" className="btn secondary" onClick={onClearOne}>
          Clear {f.label.toLowerCase()}
        </button>
      )}
    </Sheet>
  );
}
