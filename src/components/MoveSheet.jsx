import { useState } from 'react';
import Sheet from './Sheet';
import { rupees } from '../lib/format';

export default function MoveSheet({ students, from, batches, onConfirm, onClose }) {
  const others = batches.filter((b) => b.id !== from.id);
  const [to, setTo] = useState(others[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const n = students.length;
  const dest = others.find((b) => b.id === to);
  const shown = students.slice(0, 6);
  const more = n - shown.length;

  return (
    <Sheet title={`Move ${n} student${n === 1 ? '' : 's'}`} subtitle={`From ${from.name}`} onClose={onClose}>
      {others.length === 0 ? (
        <p className="muted">There is no other batch to move to. Create one first.</p>
      ) : (
        <>
          <div className="field">
            <label htmlFor="mv-to">Move to</label>
            <select id="mv-to" value={to} onChange={(e) => setTo(e.target.value)}>
              {others.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {rupees(b.fee)}/mo
                </option>
              ))}
            </select>
          </div>
          <ul className="namelist">
            {shown.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
            {more > 0 && <li className="muted">and {more} more</li>}
          </ul>
          <p className="hint">
            Their payment history moves with them.
            {dest && dest.fee !== from.fee && (
              <>
                {' '}
                The monthly fee changes from {rupees(from.fee)} to {rupees(dest.fee)}, so any earlier month that is still unpaid will count at {rupees(dest.fee)}.
              </>
            )}
          </p>
          <button
            className="btn"
            disabled={busy || !dest}
            onClick={() => {
              setBusy(true);
              onConfirm(dest);
            }}
          >
            Move to {dest ? dest.name : '…'}
          </button>
        </>
      )}
      <button className="btn secondary" disabled={busy} onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}
