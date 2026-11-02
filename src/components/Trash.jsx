import { useState } from 'react';
import Sheet from './Sheet';

const ago = (iso) => {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 864e5);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export default function Trash({ trash, onRestoreStudent, onRestoreBatch, onPurgeStudent, onPurgeBatch, onRestoreAll, onPurgeAll, onClose }) {
  // "Delete forever" needs a second tap on the same row.
  const [armed, setArmed] = useState(null);
  const empty = trash.batches.length === 0 && trash.students.length === 0;
  const people = trash.students.length + trash.batches.reduce((n, t) => n + t.students.length, 0);
  const items = trash.students.length + trash.batches.length;

  const Buttons = ({ id, restore, purge }) => (
    <div className="a">
      <button className="sbtn" onClick={restore}>
        Restore
      </button>
      <button
        className={'sbtn danger' + (armed === id ? ' armed' : '')}
        onClick={() => (armed === id ? purge() : setArmed(id))}
        onBlur={() => setArmed((a) => (a === id ? null : a))}
      >
        {armed === id ? 'Tap again to confirm' : 'Delete forever'}
      </button>
    </div>
  );

  return (
    <Sheet title="Recently deleted" subtitle="Restore brings back the student with all their payments." onClose={onClose}>
      {empty && <p className="muted">Nothing here. Deleted students and batches show up here.</p>}

      {!empty && items > 1 && (
        <div className="trow">
          <div className="m">
            {plural(items, 'item')} here{people > 0 ? ` (${plural(people, 'student')})` : ''}
          </div>
          <div className="a">
            <button className="sbtn" onClick={onRestoreAll}>
              Restore all
            </button>
            <button
              className={'sbtn danger' + (armed === 'all' ? ' armed' : '')}
              onClick={() => (armed === 'all' ? onPurgeAll() : setArmed('all'))}
              onBlur={() => setArmed((a) => (a === 'all' ? null : a))}
            >
              {armed === 'all' ? 'Tap again to confirm' : 'Empty bin'}
            </button>
          </div>
        </div>
      )}

      {trash.batches.map((t) => (
        <div className="trow" key={t.batch.id}>
          <div className="t">{t.batch.name}</div>
          <div className="m">
            Whole batch · {plural(t.students.length, 'student')} · {plural(t.paymentCount, 'payment')} · deleted {ago(t.deleted_at)}
          </div>
          <Buttons id={t.batch.id} restore={() => onRestoreBatch(t.batch.id)} purge={() => onPurgeBatch(t.batch.id)} />
        </div>
      ))}

      {trash.students.map((t) => (
        <div className="trow" key={t.student.id}>
          <div className="t">{t.student.name}</div>
          <div className="m">
            {t.batchName}
            {t.batchGone ? ' (batch also deleted, comes back with them)' : ''} · {plural(t.paymentCount, 'payment')} · deleted {ago(t.deleted_at)}
          </div>
          <Buttons id={t.student.id} restore={() => onRestoreStudent(t.student.id)} purge={() => onPurgeStudent(t.student.id)} />
        </div>
      ))}
    </Sheet>
  );
}
