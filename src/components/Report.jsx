import { Icon } from './Icons';
import { dateLabel, monthLabel } from '../lib/dates';
import { download, rupees, toCsv } from '../lib/format';

export default function Report({ view, month, onClose }) {
  function exportCsv() {
    const rows = [['Batch', 'Student', 'Student phone', 'Parent phone', 'Month', 'Status', 'Amount received', 'Date paid', 'Note']];
    for (const v of view.batches) {
      for (const { student, payment } of v.rows) {
        rows.push([
          v.batch.name,
          student.name,
          student.phone,
          student.parent_phone || '',
          month,
          payment ? 'Paid' : 'Due',
          payment ? payment.amount : '',
          payment ? payment.paid_on : '',
          payment ? payment.note : '',
        ]);
      }
    }
    download(`fee-report-${month}.csv`, toCsv(rows));
  }

  return (
    <div className="report-overlay">
      <div className="report">
        <div className="report-actions no-print">
          <button className="sbtn" onClick={onClose}>
            <Icon.Left width={18} height={18} /> Back
          </button>
          <button className="sbtn primary" onClick={exportCsv}>
            <Icon.Download width={18} height={18} /> Download CSV
          </button>
          <button className="sbtn" onClick={() => window.print()}>
            <Icon.Printer width={18} height={18} /> Print / Save PDF
          </button>
        </div>

        <div className="print-area">
          <h1>Fee report · {monthLabel(month)}</h1>
          <p className="muted">
            Collected {rupees(view.collected)} · Pending {rupees(view.pending)} · {view.paidCount} paid, {view.dueCount} due
          </p>

          {view.batches.map((v) => (
            <section key={v.batch.id}>
              <h3>
                {v.batch.name} <span className="muted">({rupees(v.batch.fee)} / month)</span>
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Paid on</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {v.rows.map(({ student, payment }) => (
                    <tr key={student.id}>
                      <td>{student.name}</td>
                      <td>{payment ? 'Paid' : 'Due'}</td>
                      <td>{payment ? dateLabel(payment.paid_on) : '–'}</td>
                      <td className="num">{payment ? rupees(payment.amount) : '–'}</td>
                    </tr>
                  ))}
                  <tr className="tot">
                    <td colSpan={3}>
                      Collected ({v.paidCount} of {v.total})
                    </td>
                    <td className="num">{rupees(v.collected)}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
