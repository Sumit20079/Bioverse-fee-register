import { useState } from 'react';
import Sheet from './Sheet';

export default function BatchSheet({ batch, studentCount = 0, onSave, onDelete, onClose }) {
  const editing = Boolean(batch);
  const [name, setName] = useState(batch?.name || '');
  const [fee, setFee] = useState(batch ? String(batch.fee) : '');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const valid = name.trim() && fee !== '' && Number(fee) >= 0;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const ok = await onSave({ id: batch?.id, name: name.trim(), fee: Math.round(Number(fee)) });
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
          <b>{batch.name}</b> will be removed. This can&apos;t be undone.
        </p>
        <button className="btn" style={{ background: 'var(--danger)' }} disabled={busy} onClick={remove}>
          Yes, delete batch
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
          {editing && <p className="hint">Changing the fee only affects months not yet paid. Recorded payments keep their amount.</p>}
        </div>
        <button className="btn" disabled={!valid || busy}>{editing ? 'Save changes' : 'Create batch'}</button>
      </form>

      {editing && (
        <div className="stack" style={{ gap: 8 }}>
          <button type="button" className="btn danger" disabled={studentCount > 0 || busy} onClick={() => setConfirming(true)}>
            Delete batch
          </button>
          {studentCount > 0 && (
            <p className="hint">
              Can&apos;t delete while it has {studentCount} student{studentCount === 1 ? '' : 's'}. Move them to another batch or delete them first.
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
