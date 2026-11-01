import { useState } from 'react';
import MonthNav from './MonthNav';
import { Icon } from './Icons';
import { dateLabel, monthShort } from '../lib/dates';
import { rupees } from '../lib/format';
import { useWide } from '../lib/useWide';

export default function BatchDetail({ v, month, setMonth, onBack, onPay, onEditStudent, onEditBatch, onAddStudent, onDeleteMany }) {
  const [filter, setFilterRaw] = useState('all');
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const wide = useWide();
  const { batch } = v;
  const rows = v.rows.filter((r) => (filter === 'paid' ? r.payment : filter === 'due' ? !r.payment : true));

  // Only ever act on rows that are on screen, so a hidden student can't be deleted by accident.
  const chosen = rows.filter((r) => picked.has(r.student.id));
  const allPicked = rows.length > 0 && chosen.length === rows.length;

  const setFilter = (f) => {
    setFilterRaw(f);
    setPicked(new Set());
  };
  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
  };
  const toggle = (id) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.student.id)));

  const detail = (student, payment) =>
    payment
      ? `${payment.amount < batch.fee ? `${rupees(payment.amount)} of ${rupees(batch.fee)}` : rupees(payment.amount)} · ${dateLabel(payment.paid_on)}${payment.note ? ` · ${payment.note}` : ''}`
      : student.active
        ? 'Not paid yet'
        : 'Left';

  return (
    <>
      <header className="head">
        <div className="back">
          <button className="iconbtn plain" aria-label="Back" onClick={onBack}>
            <Icon.Left width={24} height={24} />
          </button>
          <div>
            <h1 className="sm">{batch.name}</h1>
            <div className="kicker">
              {rupees(batch.fee)}/mo · {monthShort(month)} {month.slice(0, 4)}
            </div>
          </div>
        </div>
        <MonthNav month={month} onChange={setMonth} />
      </header>

      <div className="card summary">
        <div>
          <div className="k">Collected</div>
          <div className="v">{rupees(v.collected)}</div>
        </div>
        <div className="r">
          <div className="k">Pending</div>
          <div className="v">{rupees(v.pending)}</div>
        </div>
      </div>

      <div className="chips" role="group" aria-label="Filter students">
        {[
          ['all', `All ${v.total}`],
          ['paid', `Paid ${v.paidCount}`],
          ['due', `Due ${v.dueCount}`],
        ].map(([key, label]) => (
          <button key={key} className={'chip' + (filter === key ? ' on' : '')} aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
        {v.total > 0 && (
          <button className={'chip' + (selecting ? ' on' : '')} aria-pressed={selecting} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
            {selecting ? 'Done' : 'Select'}
          </button>
        )}
        <button className="chip" onClick={onEditBatch}>
          Edit batch
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card empty" style={{ marginInline: 20 }}>
          <p>{v.total === 0 ? 'No students in this batch yet.' : 'Nobody here for this filter.'}</p>
          {v.total === 0 && (
            <button className="sbtn primary" onClick={onAddStudent}>
              <Icon.Plus /> Add student
            </button>
          )}
        </div>
      ) : wide ? (
        <div className="tablewrap">
          <table className="grid-table">
            <thead>
              <tr>
                {selecting && (
                  <th className="pick">
                    <input type="checkbox" checked={allPicked} onChange={toggleAll} aria-label="Select all shown students" />
                  </th>
                )}
                <th>Student</th>
                <th>Student no.</th>
                <th>Parent no.</th>
                <th>Status</th>
                <th className="num">Amount</th>
                <th>Paid on</th>
                <th>Note</th>
                <th>
                  <span className="sr">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ student, payment }, i) => (
                <tr
                  key={student.id}
                  className={'rise' + (selecting ? ' selectable' : '') + (picked.has(student.id) ? ' picked' : '')}
                  style={{ '--i': i }}
                  onClick={selecting ? () => toggle(student.id) : undefined}
                >
                  {selecting && (
                    <td className="pick">
                      <input type="checkbox" checked={picked.has(student.id)} onChange={() => {}} aria-label={`Select ${student.name}`} />
                    </td>
                  )}
                  <td>
                    {selecting ? (
                      <b>{student.name}</b>
                    ) : (
                      <button className="name-btn" onClick={() => onEditStudent(student)} aria-label={`Edit ${student.name}`}>
                        {student.name}
                      </button>
                    )}
                    {!student.active && <span className="tag">Left</span>}
                  </td>
                  <td className="muted">{student.phone || '–'}</td>
                  <td className="muted">{student.parent_phone || '–'}</td>
                  <td>
                    <span className={'status ' + (payment ? 'paid' : 'due')}>{payment ? 'Paid' : 'Due'}</span>
                  </td>
                  <td className="num">
                    {payment ? rupees(payment.amount) : '–'}
                    {payment && payment.amount < batch.fee && <div className="muted small">of {rupees(batch.fee)}</div>}
                  </td>
                  <td>{payment ? dateLabel(payment.paid_on) : '–'}</td>
                  <td className="muted">{payment?.note || ''}</td>
                  <td className="act">
                    {!selecting &&
                      (payment ? (
                        <button className="sbtn" onClick={() => onPay(student, month)} aria-label={`Edit payment for ${student.name}`}>
                          Edit
                        </button>
                      ) : (
                        <button className="sbtn primary" onClick={() => onPay(student, month)}>
                          Mark paid
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="list">
          {rows.map(({ student, payment }, i) =>
            selecting ? (
              <label className={'row sel rise' + (picked.has(student.id) ? ' picked' : '')} style={{ '--i': i }} key={student.id}>
                <input type="checkbox" checked={picked.has(student.id)} onChange={() => toggle(student.id)} />
                <span className="who">
                  <span className="n">{student.name}</span>
                  <span className="d">{detail(student, payment)}</span>
                </span>
              </label>
            ) : (
              <div className="row rise" style={{ '--i': i }} key={student.id}>
                <button className="who" onClick={() => onEditStudent(student)} aria-label={`Edit ${student.name}`}>
                  <div className="n">{student.name}</div>
                  <div className="d">{detail(student, payment)}</div>
                </button>
                {payment ? (
                  <button className="pill paid" aria-label={`Paid. Edit payment for ${student.name}`} onClick={() => onPay(student, month)}>
                    <Icon.Check width={14} height={14} strokeWidth={2.4} /> Paid
                  </button>
                ) : (
                  <button className="pill due" onClick={() => onPay(student, month)}>
                    Mark paid
                  </button>
                )}
              </div>
            ),
          )}
        </div>
      )}

      {selecting ? (
        <div className="selbar" role="region" aria-label="Selection actions">
          <span className="count" aria-live="polite">
            {chosen.length} selected
          </span>
          <button className="sbtn" onClick={toggleAll}>
            {allPicked ? 'None' : 'All'}
          </button>
          <button
            className="sbtn del"
            disabled={chosen.length === 0}
            onClick={() =>
              onDeleteMany(
                chosen.map((r) => r.student.id),
                stopSelecting,
              )
            }
          >
            Delete
          </button>
        </div>
      ) : (
        <div className="fabwrap">
          <button className="fab" aria-label="Add student" onClick={onAddStudent}>
            <Icon.Plus width={24} height={24} strokeWidth={2} />
          </button>
        </div>
      )}
    </>
  );
}
