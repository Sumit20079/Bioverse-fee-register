import { useState } from 'react';
import Sheet from './Sheet';
import { mainParent } from '../lib/admissions';
import { feeFor } from '../lib/calc';
import { monthLabel } from '../lib/dates';
import { rupees } from '../lib/format';

const pretty = (p) => {
  const d = String(p || '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : p || '';
};

export default function EnrollSheet({ app: a, batches, month, dup, onBack, onClose, onConfirm }) {
  const [batchId, setBatchId] = useState('');
  const [busy, setBusy] = useState(false);
  const mp = mainParent(a);

  const go = async () => {
    setBusy(true);
    const ok = await onConfirm(batchId);
    if (!ok) setBusy(false);
  };

  return (
    <Sheet title={`Enroll ${a.student_name}`} subtitle="Pick a batch. The fee comes from the batch." onClose={onClose}>
      {dup && <p className="notice">Check first: this phone number, or this name and school, is already in the fee register or in another application.</p>}

      {batches.length === 0 ? (
        <p className="notice">There are no batches yet. Create a batch in the fee register first.</p>
      ) : (
        <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="Batch">
          {batches.map((b) => (
            <label key={b.id} className={'enroll-batch' + (batchId === b.id ? ' on' : '')}>
              <input type="radio" name="enroll-batch" checked={batchId === b.id} onChange={() => setBatchId(b.id)} />
              <span className="dot" aria-hidden="true" />
              <span className="txt">
                <b>{b.name}</b>
                <small>{rupees(feeFor(b, month))} / month</small>
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="card adm-detail enroll-sum">
        <div className="adm-row">
          <span className="k">Student phone</span>
          <span className="v">{pretty(a.student_phone)}</span>
        </div>
        <div className="adm-row">
          <span className="k">Parent phone</span>
          <span className="v">
            {pretty(mp.phone)} ({mp.role.toLowerCase()})
          </span>
        </div>
        <div className="adm-row">
          <span className="k">Fees start</span>
          <span className="v">{monthLabel(month)}</span>
        </div>
      </div>

      <button type="button" className="btn" disabled={!batchId || busy} onClick={go}>
        Add to fee register
      </button>
      <button type="button" className="btn secondary" disabled={busy} onClick={onBack}>
        Back
      </button>
    </Sheet>
  );
}
