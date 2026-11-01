import Sheet from './Sheet';
import { Icon } from './Icons';
import { currentMonth, dateLabel, monthLabel, monthsBetween } from '../lib/dates';
import { monthStatus } from '../lib/calc';
import { contactsOf, rupees, telLink, waLink } from '../lib/format';

// Every month for one student, newest first. Tap a month to record or edit its payment.
export default function StudentHistory({ student, batch, payments, onPay, onEdit, onClose }) {
  const byMonth = new Map();
  for (const p of payments) byMonth.set(p.month, [...(byMonth.get(p.month) || []), p]);
  const months = new Set(monthsBetween(student.joined_month, currentMonth()));
  byMonth.forEach((_p, m) => months.add(m));
  const list = [...months].sort().reverse();

  const received = payments.reduce((t, p) => t + p.amount, 0);
  const stat = (m) => monthStatus(byMonth.get(m) || [], batch.fee);
  const unpaid = student.active ? list.filter((m) => m >= student.joined_month && !stat(m).settled).length : 0;
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
          const s = stat(m);
          const n = s.rows.length;
          return (
            <div className="row" key={m}>
              <button className="who" onClick={() => onPay(student, m)} aria-label={`${monthLabel(m)}: ${s.status === 'paid' ? 'paid' : s.status === 'part' ? 'part paid' : 'not paid'}`}>
                <div className="n">{monthLabel(m)}</div>
                <div className="d">
                  {s.status === 'part'
                    ? `${rupees(s.received)} paid · ${rupees(s.balance)} left · ${dateLabel(s.last.paid_on)}${n > 1 ? ` · ${n} payments` : ''}`
                    : s.status === 'paid'
                      ? `${s.received < batch.fee ? `${rupees(s.received)} of ${rupees(batch.fee)}` : rupees(s.received)} · ${dateLabel(s.last.paid_on)}${n > 1 ? ` · ${n} payments` : s.last.note ? ` · ${s.last.note}` : ''}`
                      : student.active || m < currentMonth()
                        ? 'Not paid'
                        : '–'}
                </div>
              </button>
              {s.status === 'paid' ? <span className="pill paid">Paid</span> : <span className="pill due">{s.status === 'part' ? 'Part' : 'Due'}</span>}
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
