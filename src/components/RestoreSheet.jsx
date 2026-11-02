import { useState } from 'react';
import Sheet from './Sheet';
import { parseBackup, planRestore } from '../lib/restore';

const plural = (n, w) => `${n.toLocaleString('en-IN')} ${w}${n === 1 ? '' : 's'}`;

export default function RestoreSheet({ loadCurrent, onRestore, onClose }) {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');

  async function readFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setPlan(null);
    setError('');
    setName(f.name);
    try {
      const file = parseBackup(await f.text());
      setPlan(planRestore(file, await loadCurrent()));
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function go() {
    setBusy(true);
    const ok = await onRestore(plan);
    if (!ok) setBusy(false);
  }

  return (
    <Sheet title="Restore from backup" subtitle="Adds back anything that is missing. Nothing already here is changed or deleted." onClose={onClose}>
      <div className="field">
        <label htmlFor="rs-file" className="sbtn" style={{ cursor: 'pointer' }}>
          {name ? 'Choose a different file' : 'Choose backup file'}
        </label>
        <input id="rs-file" type="file" accept=".json,application/json" onChange={readFile} style={{ display: 'none' }} />
      </div>

      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}

      {plan && plan.total === 0 && (
        <p role="status">
          Nothing to restore. Everything in {name} ({plural(plan.inFile.students, 'student')}, {plural(plan.inFile.payments, 'payment')}) is already in the app.
        </p>
      )}

      {plan && plan.total > 0 && (
        <>
          <p role="status">
            {name} has {plural(plan.inFile.students, 'student')} and {plural(plan.inFile.payments, 'payment')}. These are missing here and will be added:
          </p>
          <ul className="namelist">
            {plan.batches.length > 0 && <li>{plural(plan.batches.length, 'batch')}</li>}
            {plan.students.length > 0 && <li>{plural(plan.students.length, 'student')}</li>}
            {plan.payments.length > 0 && <li>{plural(plan.payments.length, 'payment')}</li>}
          </ul>
          {plan.skipped > 0 && <p className="hint">{plural(plan.skipped, 'row')} in the file can&apos;t be restored because the student or batch they belong to isn&apos;t in the file.</p>}
          <button className="btn" disabled={busy} onClick={go}>
            {busy ? 'Restoring…' : 'Restore these'}
          </button>
        </>
      )}

      <button className="btn secondary" disabled={busy} onClick={onClose}>
        {plan && plan.total > 0 ? 'Cancel' : 'Close'}
      </button>
    </Sheet>
  );
}
