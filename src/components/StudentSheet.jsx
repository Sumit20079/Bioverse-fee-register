import { useState } from 'react';
import Sheet from './Sheet';
import { currentMonth } from '../lib/dates';

export default function StudentSheet({ student, batches, defaultBatchId, month, paymentCount = 0, onSave, onDelete, onClose }) {
  const editing = Boolean(student);
  const [name, setName] = useState(student?.name || '');
  const [phone, setPhone] = useState(student?.phone || '');
  const [parentPhone, setParentPhone] = useState(student?.parent_phone || '');
  const [batchId, setBatchId] = useState(student?.batch_id || defaultBatchId || batches[0]?.id || '');
  const [joined, setJoined] = useState(student?.joined_month || month || currentMonth());
  const [active, setActive] = useState(student?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const valid = name.trim() && batchId && /^\d{4}-\d{2}$/.test(joined);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const ok = await onSave({
      id: student?.id,
      name: name.trim(),
      phone: phone.replace(/[^\d+]/g, ''),
      parent_phone: parentPhone.replace(/[^\d+]/g, ''),
      batch_id: batchId,
      joined_month: joined,
      active,
    });
    if (!ok) setBusy(false);
  }

  async function remove() {
    setBusy(true);
    const ok = await onDelete(student.id);
    if (!ok) setBusy(false);
  }

  if (confirming) {
    return (
      <Sheet title="Delete this student?" onClose={onClose}>
        <p role="alert">
          <b>{student.name}</b> will be removed
          {paymentCount > 0
            ? `, together with ${paymentCount} payment record${paymentCount === 1 ? '' : 's'}`
            : ''}
          . This can&apos;t be undone.
        </p>
        <p className="hint">If they just left the class, cancel and untick “Still attending” instead. Their payment history stays.</p>
        <button className="btn" style={{ background: 'var(--danger)' }} disabled={busy} onClick={remove}>
          Yes, delete student
        </button>
        <button className="btn secondary" disabled={busy} onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title={editing ? 'Edit student' : 'Add student'} onClose={onClose}>
      <form className="stack" style={{ gap: 16 }} onSubmit={save}>
        <div className="field">
          <label htmlFor="st-name">Name</label>
          <input id="st-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!editing} />
        </div>
        <div className="field">
          <label htmlFor="st-phone">Student&apos;s phone</label>
          <input id="st-phone" type="tel" inputMode="tel" value={phone} placeholder="98300 12345" onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="st-parent-phone">Parent&apos;s phone</label>
          <input id="st-parent-phone" type="tel" inputMode="tel" value={parentPhone} placeholder="98300 54321" onChange={(e) => setParentPhone(e.target.value)} />
          <p className="hint">Both are optional. Reminders can go to either one.</p>
        </div>
        <div className="field">
          <label htmlFor="st-batch">Batch</label>
          <select id="st-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="st-joined">Fees start from</label>
          <input id="st-joined" type="month" value={joined} onChange={(e) => setJoined(e.target.value)} />
          <p className="hint">Months before this are never counted as due.</p>
        </div>
        {editing && (
          <label className="check">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Still attending
          </label>
        )}
        <button className="btn" disabled={!valid || busy}>{editing ? 'Save changes' : 'Add student'}</button>
      </form>

      {editing && (
        <button type="button" className="btn danger" disabled={busy} onClick={() => setConfirming(true)}>
          Delete student
        </button>
      )}
    </Sheet>
  );
}
