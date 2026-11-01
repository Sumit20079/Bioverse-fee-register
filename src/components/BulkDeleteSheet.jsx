import { useState } from 'react';
import Sheet from './Sheet';

export default function BulkDeleteSheet({ students, paymentCount, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const n = students.length;
  const shown = students.slice(0, 6);
  const more = n - shown.length;

  return (
    <Sheet title={`Delete ${n} student${n === 1 ? '' : 's'}?`} onClose={onClose}>
      <p role="alert">
        {paymentCount > 0
          ? `They will be removed together with ${paymentCount} payment record${paymentCount === 1 ? '' : 's'}. `
          : 'They will be removed. '}
        This can&apos;t be undone.
      </p>
      <ul className="namelist">
        {shown.map((s) => (
          <li key={s.id}>{s.name}</li>
        ))}
        {more > 0 && <li className="muted">and {more} more</li>}
      </ul>
      <p className="hint">If they just left the class, cancel and untick “Still attending” on each student instead. Their payment history stays.</p>
      <button
        className="btn"
        style={{ background: 'var(--danger)' }}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          onConfirm();
        }}
      >
        Yes, delete {n} student{n === 1 ? '' : 's'}
      </button>
      <button className="btn secondary" disabled={busy} onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}
