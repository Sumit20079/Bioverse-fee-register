import { useState } from 'react';
import Sheet from './Sheet';
import { addMonths, currentMonth, monthLabel } from '../lib/dates';

export default function BatchSheet({ batch, studentCount = 0, paymentCount = 0, onSave, onDelete, onClose }) {
  const editing = Boolean(batch);
  const [name, setName] = useState(batch?.name || '');
  const [fee, setFee] = useState(batch ? String(batch.fee) : '');
  const [from, setFrom] = useState(currentMonth());
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const changed = editing && fee !== '' && Math.round(Number(fee)) !== batch.fee;
  const fromOptions = Array.from({ length: 14 }, (_, i) => addMonths(currentMonth(), 1 - i)); // next month back to a year ago
  const valid = name.trim() && fee !== '' && Number(fee) >= 0;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const ok = await onSave({ id: batch?.id, name: name.trim(), fee: Math.round(Number(fee)), from });
    if (!ok) setBusy(false);
  }

  async function remove() {
    setBusy(true);
    const ok = await onDelete(batch.id);
    if (!ok) setBusy(false);
  }

  if (confirming) {
    return (
      <Sheet title="Delete this batch?" onClose={onClose}>
        <p role="alert">
          <b>{batch.name}</b>
          {studentCount > 0
            ? `, with its ${studentCount} student${studentCount === 1 ? '' : 's'} and ${paymentCount} payment record${paymentCount === 1 ? '' : 's'},`
            : ''}{' '}
          will move to Recently deleted. You can restore it from the Overview screen.
        </p>
        {studentCount > 0 && (
          <p className="hint">Only want to stop a class? Cancel, open each student and untick “Still attending” to keep their history.</p>
        )}
        <button className="btn" style={{ background: 'var(--danger)' }} disabled={busy} onClick={remove}>
          {studentCount > 0 ? `Yes, delete batch and ${studentCount} student${studentCount === 1 ? '' : 's'}` : 'Yes, delete batch'}
        </button>
        <button className="btn secondary" disabled={busy} onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title={editing ? 'Edit batch' : 'New batch'} onClose={onClose}>
      <form className="stack" style={{ gap: 16 }} onSubmit={save}>
        <div className="field">
          <label htmlFor="b-name">Batch name</label>
          <input id="b-name" value={name} placeholder="Class 11 Bio · Morning" onChange={(e) => setName(e.target.value)} autoFocus={!editing} />
        </div>
        <div className="field">
          <label htmlFor="b-fee">Monthly fee (₹)</label>
          <input id="b-fee" inputMode="numeric" value={fee} placeholder="1500" onChange={(e) => setFee(e.target.value.replace(/[^\d]/g, ''))} />
          {editing && !changed && <p className="hint">Pick a new fee and choose which month it starts from. Earlier months keep the old fee.</p>}
        </div>
        {changed && (
          <div className="field">
            <label htmlFor="b-from">New fee applies from</label>
            <select id="b-from" value={from} onChange={(e) => setFrom(e.target.value)}>
              {fromOptions.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}{m === currentMonth() ? ' (this month)' : ''}
                </option>
              ))}
            </select>
            <p className="hint">Months before {monthLabel(from)} stay at {batch.fee_history?.length ? 'their old fees' : `₹${batch.fee}`}. Payments already recorded never change.</p>
          </div>
        )}
        <button className="btn" disabled={!valid || busy}>{editing ? 'Save changes' : 'Create batch'}</button>
      </form>

      {editing && (
        <button type="button" className="btn danger" disabled={busy} onClick={() => setConfirming(true)}>
          Delete batch
        </button>
      )}
    </Sheet>
  );
}
