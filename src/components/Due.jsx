import { useMemo, useState } from 'react';
import MonthNav from './MonthNav';
import { Icon } from './Icons';
import { monthLabel, monthsText } from '../lib/dates';
import { contactsOf, reminderText, rupees, telLink, waLink } from '../lib/format';
import { useWide } from '../lib/useWide';

export default function Due({ list, batches, month, setMonth, onPay }) {
  const [batchId, setBatchId] = useState('all');
  const wide = useWide();
  const shown = useMemo(() => list.filter((d) => batchId === 'all' || d.batch.id === batchId), [list, batchId]);
  const total = shown.reduce((t, d) => t + d.amount, 0);

  // One entry per student, with a WhatsApp/call link for each number we have.
  const items = shown.map((d) => {
    const label = monthsText(d.months);
    const contacts = contactsOf(d.student).map((c) => ({
      ...c,
      wa: waLink(c.phone, reminderText({ name: d.student.name, amount: d.amount, monthsLabel: label, batchName: d.batch.name, to: c.to })),
      tel: telLink(c.phone),
    }));
    return { d, label, shown: label + (d.partial ? ' · part paid' : ''), contacts };
  });

  const payBtn = ({ d }) => (
    <button className="sbtn primary" onClick={() => onPay(d.student, d.months[0])}>
      <Icon.Check width={18} height={18} /> Mark paid
    </button>
  );

  // Laptop: Mark paid plus one WhatsApp button per number.
  const tableActions = (it) => (
    <>
      {payBtn(it)}
      {it.contacts.map((c) => (
        <a key={c.role} className="sbtn" href={c.wa || undefined} target="_blank" rel="noreferrer" aria-disabled={!c.wa} aria-label={`WhatsApp ${c.role.toLowerCase()} of ${it.d.student.name}`}>
          <Icon.Chat width={18} height={18} /> {c.role}
        </a>
      ))}
    </>
  );

  // Phone: Mark paid, then one line per number with its own WhatsApp and call buttons.
  const cardActions = (it) => (
    <>
      <div className="due-actions">{payBtn(it)}</div>
      {it.contacts.length === 0 && <div className="muted small">No phone number saved</div>}
      {it.contacts.map((c) => (
        <div className="contact" key={c.role}>
          <div className="who">
            <span className="role">{c.role}</span>
            <span className="muted small">{c.phone}</span>
          </div>
          <a className="sbtn" href={c.wa || undefined} target="_blank" rel="noreferrer" aria-disabled={!c.wa} aria-label={`WhatsApp ${c.role.toLowerCase()} of ${it.d.student.name}`}>
            <Icon.Chat width={18} height={18} /> WhatsApp
          </a>
          <a className="sbtn call" href={c.tel || undefined} aria-disabled={!c.tel} aria-label={`Call ${c.role.toLowerCase()} of ${it.d.student.name}`}>
            <Icon.Phone width={18} height={18} />
          </a>
        </div>
      ))}
    </>
  );

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

      {items.length === 0 ? (
        <div className="card empty" style={{ marginInline: 20, marginTop: 12 }}>
          <p>Everyone is paid up. Nothing to chase.</p>
        </div>
      ) : wide ? (
        <div className="tablewrap" style={{ marginTop: batches.length > 1 ? 0 : 14 }}>
          <table className="grid-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Batch</th>
                <th>Months owed</th>
                <th className="num">Amount due</th>
                <th>
                  <span className="sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.d.student.id} className="rise" style={{ '--i': i }}>
                  <td>
                    <b>{it.d.student.name}</b>
                    <div className="muted small">
                      {it.contacts.length ? it.contacts.map((c) => `${c.role[0]}: ${c.phone}`).join(' · ') : 'No phone'}
                    </div>
                  </td>
                  <td className="muted">{it.d.batch.name}</td>
                  <td>{it.shown}</td>
                  <td className="num amt-due">{rupees(it.d.amount)}</td>
                  <td className="act">{tableActions(it)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="list" style={{ marginTop: batches.length > 1 ? 0 : 14 }}>
          {items.map((it, i) => (
            <div className="due-row rise" style={{ '--i': i }} key={it.d.student.id}>
              <div className="top">
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{it.d.student.name}</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{it.d.batch.name}</div>
                </div>
                <div className="amt">
                  <b>{rupees(it.d.amount)}</b>
                  <span>{it.shown}</span>
                </div>
              </div>
              {cardActions(it)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
