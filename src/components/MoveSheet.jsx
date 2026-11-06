import { useState } from 'react';
import Sheet from './Sheet';
import { rupees } from '../lib/format';
import { currentMonth, monthLabel, monthsBetween } from '../lib/dates';

export default function MoveSheet({ students, from, batches, onConfirm, onClose }) {
  const now = currentMonth();
  const earliest = students.reduce((m, s) => (s.joined_month < m ? s.joined_month : m), now);
  const months = monthsBetween(earliest, now).reverse();
  const [fromMonth, setFromMonth] = useState(now);
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
          <div className="field">
            <label htmlFor="mv-from">Starting from</label>
            <select id="mv-from" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                  {m === now ? ' (this month)' : ''}
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
            Months before {monthLabel(fromMonth)} stay in {from.name} with their old fee and payments.
            {dest && dest.fee !== from.fee && (
              <>
                {' '}
                From {monthLabel(fromMonth)} the fee is {rupees(dest.fee)} instead of {rupees(from.fee)}.
              </>
            )}
          </p>
          <button
            className="btn"
            disabled={busy || !dest}
            onClick={() => {
              setBusy(true);
              onConfirm(dest, fromMonth);
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
