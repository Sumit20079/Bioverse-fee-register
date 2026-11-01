import { useEffect, useMemo, useState } from 'react';
import Sheet from './Sheet';
import { dateLabel, longDateLabel, monthLabel, todayISO } from '../lib/dates';
import { monthStatus } from '../lib/calc';
import { receiptContact, receiptText, rupees, waLink } from '../lib/format';

const isPending = (id) => String(id).startsWith('pending-');

// paymentsByMonth: month -> this student's payments for it. A month can hold several
// instalments; tap one to edit it, or add a new one.
export default function PaymentSheet({ student, batch, month: initialMonth, monthOptions, paymentsByMonth, onSave, onRemove, onClose }) {
  const [month, setMonth] = useState(initialMonth);
  const rows = useMemo(
    () => [...(paymentsByMonth.get(month) || [])].sort((a, b) => (a.paid_on || '').localeCompare(b.paid_on || '')),
    [paymentsByMonth, month],
  );
  const ms = monthStatus(rows, batch.fee);

  const [editId, setEditId] = useState(null); // null = adding a new payment
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(todayISO());
  const [note, setNote] = useState('');
  const [waive, setWaive] = useState(false);
  const [busy, setBusy] = useState(false);

  function load(id) {
    const r = id ? rows.find((x) => x.id === id) : null;
    setEditId(r ? r.id : null);
    if (r) {
      setAmount(String(r.amount));
      setPaidOn(r.paid_on);
      setNote(r.note || '');
      setWaive(r.settled !== false && ms.received < batch.fee);
    } else {
      const left = rows.length ? ms.balance : batch.fee;
      setAmount(left > 0 ? String(left) : '');
      setPaidOn(todayISO());
      setNote('');
      setWaive(false);
    }
  }

  // Reset the form when the month or the saved payments change (not on every refresh,
  // so something half-typed is never wiped).
  const rowsKey = rows.map((r) => [r.id, r.amount, r.paid_on, r.note, r.settled].join(':')).join('|');
  useEffect(() => {
    const last = rows[rows.length - 1];
    load(last && ms.settled && !isPending(last.id) ? last.id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, rowsKey, batch.fee]);

  const value = Number(amount);
  const valid = amount !== '' && Number.isFinite(value) && value >= 0 && paidOn;
  const others = rows.filter((r) => r.id !== editId).reduce((t, r) => t + r.amount, 0);
  const leftBefore = Math.max(0, batch.fee - others);
  const leftAfter = Math.max(0, leftBefore - (valid ? Math.round(value) : 0));
  const editingRow = editId ? rows.find((r) => r.id === editId) : null;

  async function save() {
    setBusy(true);
    const amt = Math.round(value);
    const ok = await onSave({
      id: editId || undefined,
      student_id: student.id,
      month,
      amount: amt,
      paid_on: paidOn,
      note: note.trim(),
      settled: others + amt >= batch.fee || waive,
    });
    if (!ok) setBusy(false);
  }

  async function remove() {
    setBusy(true);
    const ok = await onRemove([editId], month);
    if (!ok) setBusy(false);
  }

  const rc = editingRow ? receiptContact(student) : null;
  const receiptHref = rc
    ? waLink(
        rc.phone,
        receiptText({
          name: student.name,
          amount: editingRow.amount,
          monthLabel: monthLabel(month),
          batchName: batch.name,
          paidOn: longDateLabel(editingRow.paid_on),
          balance: ms.balance,
          to: rc.to,
        }),
      )
    : null;

  const monthTag = (m) => {
    const s = monthStatus(paymentsByMonth.get(m) || [], batch.fee).status;
    return s === 'paid' ? ' (paid)' : s === 'part' ? ' (part paid)' : '';
  };

  return (
    <Sheet title={student.name} subtitle={`${batch.name} · ${rupees(batch.fee)} / month`} onClose={onClose}>
      <div className="field">
        <label htmlFor="pay-month">Month</label>
        <select id="pay-month" value={month} onChange={(e) => setMonth(e.target.value)}>
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
              {monthTag(m)}
            </option>
          ))}
        </select>
      </div>

      {rows.length > 0 && (
        <div className="instal">
          <div className="instal-sum">
            <span>
              {rupees(ms.received)} of {rupees(batch.fee)} received
            </span>
            <b className={ms.balance > 0 ? 'left' : 'ok'}>{ms.balance > 0 ? `${rupees(ms.balance)} left` : 'Settled'}</b>
          </div>
          {rows.length > 1 || !ms.settled ? (
            <div className="instal-list" role="group" aria-label="Payments this month">
              {rows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={'instal-row' + (r.id === editId ? ' on' : '')}
                  disabled={isPending(r.id)}
                  aria-pressed={r.id === editId}
                  onClick={() => load(r.id)}
                >
                  <span>
                    {rupees(r.amount)} · {dateLabel(r.paid_on)}
                    {r.note ? ` · ${r.note}` : ''}
                  </span>
                  <span className="muted small">{r.id === editId ? 'Editing' : 'Edit'}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}

      <div className="field">
        <label htmlFor="pay-amount">{editId ? 'Amount received' : rows.length ? 'Amount received now' : 'Amount received'}</label>
        <input id="pay-amount" className="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
        <p className="hint">
          {valid && leftAfter > 0 && !waive
            ? `${rupees(leftAfter)} will still be due for this month.`
            : rows.length
              ? 'Filled with what is still due.'
              : 'Filled from the batch fee. Enter less for a part payment.'}
        </p>
      </div>

      {valid && Math.round(value) < leftBefore && (
        <label className="check">
          <input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} />
          Waive the remaining {rupees(leftBefore - Math.round(value))} (discount, counts as fully paid)
        </label>
      )}

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
        {editId ? 'Update payment' : 'Save payment'}
      </button>
      {editId && (
        <button className="btn secondary" disabled={busy} onClick={() => load(null)}>
          Add another payment
        </button>
      )}
      {receiptHref && (
        <a className="btn secondary" href={receiptHref} target="_blank" rel="noreferrer">
          Send receipt to {rc.role.toLowerCase()} on WhatsApp
        </a>
      )}
      {editId && (
        <button className="btn danger" disabled={busy} onClick={remove}>
          {rows.length > 1 ? 'Remove this payment' : 'Mark as unpaid'}
        </button>
      )}
    </Sheet>
  );
}
