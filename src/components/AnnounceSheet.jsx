import { useEffect, useState } from 'react';
import Sheet from './Sheet';
import { loadLinked, sendAnnouncement } from '../lib/telegram';

export default function AnnounceSheet({ onClose, batches, students, flash }) {
  const [text, setText] = useState('');
  const [batch, setBatch] = useState('');
  const [linked, setLinked] = useState(null);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    loadLinked().then((l) => setLinked(l.ready ? l.linked : new Map()));
  }, []);

  // how many connected parents this would reach
  const reach = linked ? students.filter((s) => s.active && linked.has(s.id) && (!batch || s.batch_id === batch)).length : null;
  const ready = text.trim().length > 0 && reach > 0;

  const send = async () => {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    setBusy(true);
    setResult('');
    try {
      const r = await sendAnnouncement(text, batch);
      setResult(`Sent to ${r.sent} parent${r.sent === 1 ? '' : 's'}${r.failed ? `, ${r.failed} failed` : ''}.`);
      if (r.sent) setText('');
    } catch (e) {
      setResult(`Couldn’t send: ${e.message}. You need internet for this.`);
    }
    setArmed(false);
    setBusy(false);
  };

  return (
    <Sheet title="Announcement" subtitle="One message to the parents on Telegram" onClose={onClose}>
      <div className="field">
        <label htmlFor="an-to">Send to</label>
        <select id="an-to" value={batch} onChange={(e) => { setBatch(e.target.value); setArmed(false); }}>
          <option value="">All connected parents</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} only
            </option>
          ))}
        </select>
        <p className="hint">{reach === null ? 'Checking…' : reach ? `Reaches ${reach} connected parent${reach === 1 ? '' : 's'}. Others won’t see it, so share it with them on WhatsApp.` : 'No connected parent in this group yet.'}</p>
      </div>
      <div className="field">
        <label htmlFor="an-text">Message</label>
        <textarea id="an-text" rows="5" placeholder="e.g. No class this Saturday. Exam on 20 Nov." value={text} maxLength={1000} onChange={(e) => { setText(e.target.value); setArmed(false); }} />
      </div>
      <button className="btn" disabled={busy || !ready} onClick={send}>
        {busy ? 'Sending…' : armed ? `Tap again to send to ${reach}` : 'Send announcement'}
      </button>
      {result && (
        <p className="small" role="status" style={{ marginTop: 10 }}>
          {result}
        </p>
      )}
    </Sheet>
  );
}
