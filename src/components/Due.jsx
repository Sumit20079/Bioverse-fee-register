import { useMemo, useState } from 'react';
import MonthNav from './MonthNav';
import { Icon } from './Icons';
import { monthLabel, monthsText } from '../lib/dates';
import { reminderText, rupees, telLink, waLink } from '../lib/format';

export default function Due({ list, batches, month, setMonth, onPay }) {
  const [batchId, setBatchId] = useState('all');
  const shown = useMemo(() => list.filter((d) => batchId === 'all' || d.batch.id === batchId), [list, batchId]);
  const total = shown.reduce((t, d) => t + d.amount, 0);

  return (
    <>
      <header className="head">
        <div>
          <div className="kicker">Up to {monthLabel(month)}</div>
          <h1>Who hasn&apos;t paid</h1>
        </div>
        <MonthNav month={month} onChange={setMonth} />
      </header>

      <section className="dues-hero">
        <div>
          <div className="k">Still to collect</div>
          <div className="v">{rupees(total)}</div>
        </div>
        <div className="c">
          {shown.length} student{shown.length === 1 ? '' : 's'}
        </div>
      </section>

      {batches.length > 1 && (
        <div className="chips" role="group" aria-label="Filter by batch">
          <button className={'chip' + (batchId === 'all' ? ' on' : '')} aria-pressed={batchId === 'all'} onClick={() => setBatchId('all')}>
            All batches
          </button>
          {batches.map((b) => (
            <button key={b.id} className={'chip' + (batchId === b.id ? ' on' : '')} aria-pressed={batchId === b.id} onClick={() => setBatchId(b.id)}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card empty" style={{ marginInline: 20, marginTop: 12 }}>
          <p>Everyone is paid up. Nothing to chase.</p>
        </div>
      ) : (
        <div className="list" style={{ marginTop: batches.length > 1 ? 0 : 14 }}>
          {shown.map((d, i) => {
            const label = monthsText(d.months);
            const wa = waLink(d.student.phone, reminderText({ name: d.student.name, amount: d.amount, monthsLabel: label, batchName: d.batch.name }));
            const tel = telLink(d.student.phone);
            return (
              <div className="due-row rise" style={{ '--i': i }} key={d.student.id}>
                <div className="top">
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{d.student.name}</div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{d.batch.name}</div>
                  </div>
                  <div className="amt">
                    <b>{rupees(d.amount)}</b>
                    <span>{label}</span>
                  </div>
                </div>
                <div className="due-actions">
                  <button className="sbtn primary" onClick={() => onPay(d.student, d.months[0])}>
                    <Icon.Check width={18} height={18} /> Mark paid
                  </button>
                  <a className="sbtn" href={wa || undefined} target="_blank" rel="noreferrer" aria-disabled={!wa} aria-label={`WhatsApp reminder to ${d.student.name}`}>
                    <Icon.Chat width={18} height={18} /> WhatsApp
                  </a>
                  <a className="sbtn" href={tel || undefined} aria-disabled={!tel} aria-label={`Call ${d.student.name}`} style={{ flex: '0 0 44px', padding: 0 }}>
                    <Icon.Phone width={18} height={18} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
