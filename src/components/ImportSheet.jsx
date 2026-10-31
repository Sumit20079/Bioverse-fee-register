import { useMemo, useState } from 'react';
import Sheet from './Sheet';
import { parseStudents } from '../lib/format';
import { currentMonth } from '../lib/dates';

export default function ImportSheet({ batches, students, defaultBatchId, onImport, onClose }) {
  const [batchId, setBatchId] = useState(defaultBatchId || batches[0]?.id || '');
  const [joined, setJoined] = useState(currentMonth());
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const { fresh, skipped } = useMemo(() => {
    const have = new Set(students.filter((s) => s.batch_id === batchId).map((s) => s.name.trim().toLowerCase()));
    const fresh = [];
    let skipped = 0;
    for (const s of parseStudents(text)) {
      const k = s.name.toLowerCase();
      if (have.has(k)) skipped++;
      else {
        have.add(k);
        fresh.push(s);
      }
    }
    return { fresh, skipped };
  }, [text, students, batchId]);

  async function readFile(e) {
    const file = e.target.files?.[0];
    if (file) setText(await file.text());
    e.target.value = '';
  }

  async function run() {
    setBusy(true);
    const ok = await onImport(fresh.map((s) => ({ ...s, batch_id: batchId, joined_month: joined, active: true })));
    if (!ok) setBusy(false);
  }

  const batchName = batches.find((b) => b.id === batchId)?.name;

  return (
    <Sheet title="Import students" subtitle="One student per line: name, phone" onClose={onClose}>
      <div className="field">
        <label htmlFor="im-batch">Add to batch</label>
        <select id="im-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="im-joined">Fees start from</label>
        <input id="im-joined" type="month" value={joined} onChange={(e) => setJoined(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="im-text">Paste list or upload a CSV</label>
        <textarea id="im-text" value={text} placeholder={'Aarav Das, 9830012345\nIshita Roy, 9830012346'} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="im-file" className="sbtn" style={{ cursor: 'pointer' }}>Choose CSV file</label>
        <input id="im-file" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={readFile} style={{ display: 'none' }} />
      </div>
      {text.trim() && (
        <p className="muted" role="status">
          {fresh.length} new student{fresh.length === 1 ? '' : 's'} for {batchName}
          {skipped > 0 && ` (${skipped} already in this batch, skipped)`}
        </p>
      )}
      <button className="btn" disabled={!fresh.length || !batchId || !joined || busy} onClick={run}>
        Import {fresh.length || ''} student{fresh.length === 1 ? '' : 's'}
      </button>
    </Sheet>
  );
}
