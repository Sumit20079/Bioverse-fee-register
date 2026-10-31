import { useState } from 'react';
import MonthNav from './MonthNav';
import { Icon } from './Icons';
import { dateLabel, monthShort } from '../lib/dates';
import { rupees } from '../lib/format';

export default function BatchDetail({ v, month, setMonth, onBack, onPay, onEditStudent, onEditBatch, onAddStudent }) {
  const [filter, setFilter] = useState('all');
  const { batch } = v;
  const rows = v.rows.filter((r) => (filter === 'paid' ? r.payment : filter === 'due' ? !r.payment : true));

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
      ) : (
        <div className="list">
          {rows.map(({ student, payment }) => (
            <div className="row" key={student.id}>
              <button className="who" onClick={() => onEditStudent(student)} aria-label={`Edit ${student.name}`}>
                <div className="n">{student.name}</div>
                <div className="d">
                  {payment
                    ? `${payment.amount < batch.fee ? `${rupees(payment.amount)} of ${rupees(batch.fee)}` : rupees(payment.amount)} · ${dateLabel(payment.paid_on)}${payment.note ? ` · ${payment.note}` : ''}`
                    : student.active
                      ? 'Not paid yet'
                      : 'Left'}
                </div>
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
          ))}
        </div>
      )}

      <div className="fabwrap">
        <button className="fab" aria-label="Add student" onClick={onAddStudent}>
          <Icon.Plus width={24} height={24} strokeWidth={2} />
        </button>
      </div>
    </>
  );
}
