import Sheet from './Sheet';
import { Icon } from './Icons';
import { currentMonth, dateLabel, monthLabel, monthsBetween } from '../lib/dates';
import { contactsOf, rupees, telLink, waLink } from '../lib/format';

// Every month for one student, newest first. Tap a month to record or edit its payment.
export default function StudentHistory({ student, batch, payments, onPay, onEdit, onClose }) {
  const byMonth = new Map(payments.map((p) => [p.month, p]));
  const months = new Set(monthsBetween(student.joined_month, currentMonth()));
  byMonth.forEach((_p, m) => months.add(m));
  const list = [...months].sort().reverse();

  const received = payments.reduce((t, p) => t + p.amount, 0);
  const unpaid = student.active ? list.filter((m) => !byMonth.has(m) && m >= student.joined_month).length : 0;
  const contacts = contactsOf(student);

  return (
    <Sheet title={student.name} subtitle={`${batch.name} · ${rupees(batch.fee)} / month${student.active ? '' : ' · Left'}`} onClose={onClose}>
      <div className="hist-sum">
        <div>
          <div className="k">Received so far</div>
          <div className="v">{rupees(received)}</div>
        </div>
        <div>
          <div className="k">Months unpaid</div>
          <div className="v" style={unpaid ? { color: 'var(--amber-ink)' } : undefined}>{unpaid}</div>
        </div>
      </div>

      {contacts.length > 0 && (
        <div className="hist-contacts">
          {contacts.map((c) => (
            <a key={c.role} className="sbtn" href={telLink(c.phone) || undefined} aria-label={`Call ${c.role.toLowerCase()} of ${student.name}`}>
              <Icon.Phone width={16} height={16} /> {c.role} {c.phone}
            </a>
          ))}
        </div>
      )}

      <div className="list" style={{ margin: 0 }}>
        {list.map((m) => {
          const p = byMonth.get(m);
          return (
            <div className="row" key={m}>
              <button className="who" onClick={() => onPay(student, m)} aria-label={`${monthLabel(m)}: ${p ? 'paid' : 'not paid'}`}>
                <div className="n">{monthLabel(m)}</div>
                <div className="d">
                  {p
                    ? `${p.amount < batch.fee ? `${rupees(p.amount)} of ${rupees(batch.fee)}` : rupees(p.amount)} · ${dateLabel(p.paid_on)}${p.note ? ` · ${p.note}` : ''}`
                    : student.active || m < currentMonth()
                      ? 'Not paid'
                      : '–'}
                </div>
              </button>
              {p ? <span className="pill paid">Paid</span> : <span className="pill due">Due</span>}
            </div>
          );
        })}
      </div>

      <button className="btn secondary" onClick={() => onEdit(student)}>
        Edit details
      </button>
    </Sheet>
  );
}
