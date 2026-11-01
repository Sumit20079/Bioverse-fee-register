import { useEffect, useState } from 'react';
import Sheet from './Sheet';
import { longDateLabel, monthLabel, todayISO } from '../lib/dates';
import { receiptContact, receiptText, rupees, waLink } from '../lib/format';

// paidMap: month -> existing payment for this student (lets the teacher edit or undo).
export default function PaymentSheet({ student, batch, month: initialMonth, monthOptions, paidMap, onSave, onRemove, onClose }) {
  const [month, setMonth] = useState(initialMonth);
  const existing = paidMap.get(month) || null;
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(todayISO());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Reload the fields whenever the chosen month changes.
  useEffect(() => {
    const p = paidMap.get(month);
    setAmount(String(p ? p.amount : batch.fee));
    setPaidOn(p ? p.paid_on : todayISO());
    setNote(p ? p.note || '' : '');
  }, [month, paidMap, batch.fee]);

  const value = Number(amount);
  const valid = amount !== '' && Number.isFinite(value) && value >= 0 && paidOn;

  async function save() {
    setBusy(true);
    const ok = await onSave({ student_id: student.id, month, amount: Math.round(value), paid_on: paidOn, note: note.trim() });
    if (!ok) setBusy(false);
  }

  async function remove() {
    setBusy(true);
    const ok = await onRemove(existing.id);
    if (!ok) setBusy(false);
  }

  const rc = existing ? receiptContact(student) : null;
  const receiptHref = rc
    ? waLink(rc.phone, receiptText({ name: student.name, amount: existing.amount, monthLabel: monthLabel(month), batchName: batch.name, paidOn: longDateLabel(existing.paid_on), to: rc.to }))
    : null;

  return (
    <Sheet title={student.name} subtitle={`${batch.name} · ${rupees(batch.fee)} / month`} onClose={onClose}>
      <div className="field">
        <label htmlFor="pay-month">Month</label>
        <select id="pay-month" value={month} onChange={(e) => setMonth(e.target.value)}>
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
              {paidMap.has(m) ? ' (paid)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="pay-amount">Amount received</label>
        <input id="pay-amount" className="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
        <p className="hint">Filled from the batch fee. Change it for a discount or part payment.</p>
      </div>

      <div className="field">
        <label htmlFor="pay-date">Date paid</label>
        <input id="pay-date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        {paidOn && <p className="hint">{longDateLabel(paidOn)}</p>}
      </div>

      <div className="field">
        <label htmlFor="pay-note">Note (optional)</label>
        <input id="pay-note" value={note} placeholder="e.g. paid by UPI, sibling discount" onChange={(e) => setNote(e.target.value)} />
      </div>

      <button className="btn" disabled={!valid || busy} onClick={save}>
        {existing ? 'Update payment' : 'Save payment'}
      </button>
      {receiptHref && (
        <a className="btn secondary" href={receiptHref} target="_blank" rel="noreferrer">
          Send receipt to {rc.role.toLowerCase()} on WhatsApp
        </a>
      )}
      {existing && (
        <button className="btn danger" disabled={busy} onClick={remove}>
          Mark as unpaid
        </button>
      )}
    </Sheet>
  );
}
