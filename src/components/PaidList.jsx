import Sheet from './Sheet';
import { dateLabel } from '../lib/dates';
import { rupees } from '../lib/format';

// Everyone who has paid for the month, across all batches. Tap a student to see their payments.
export default function PaidList({ title, view, onOpen, onClose }) {
  const rows = view.batches.flatMap((v) => v.rows.filter((r) => !r.owes).map((r) => ({ ...r, batch: v.batch })));
  return (
    <Sheet title={title} subtitle={`${rows.length} student${rows.length === 1 ? '' : 's'} · ${rupees(view.collected)} collected`} onClose={onClose}>
      {rows.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>
          Nobody has paid yet this month.
        </p>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {rows.map(({ student, payment, batch }) => (
            <div key={student.id} className="card adm-card">
              <button className="adm-open" onClick={() => onOpen(student)}>
                <span className="adm-top">
                  <b className="adm-name">{student.name}</b>
                  {payment && <span className="adm-status enrolled">{rupees(payment.amount)}</span>}
                </span>
                <span className="adm-meta">
                  {batch.name}{payment ? ` · Paid ${dateLabel(payment.paid_on)}` : ''}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
