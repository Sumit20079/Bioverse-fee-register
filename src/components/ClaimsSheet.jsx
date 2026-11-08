import { useEffect, useState } from 'react';
import Sheet from './Sheet';
import { monthsText } from '../lib/dates';
import { rupees } from '../lib/format';
import { finishClaim, loadClaims, proofUrl } from '../lib/telegram';

const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function ClaimsSheet({ onClose, students, onRecord, flash }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [shots, setShots] = useState({});

  const load = async () => {
    try {
      setRows(await loadClaims());
    } catch {
      setErr('Couldn’t load. You need internet, and the claims table must exist in Supabase.');
    }
  };
  useEffect(() => {
    load();
  }, []);

  const show = async (c) => {
    try {
      const url = await proofUrl(c.proof_path);
      setShots((s) => ({ ...s, [c.id]: url }));
    } catch {
      flash('Couldn’t open the screenshot');
    }
  };
  const dismiss = async (c) => {
    await finishClaim(c.id).catch(() => {});
    setRows((r) => r.filter((x) => x.id !== c.id));
    flash('Dismissed');
  };

  return (
    <Sheet title="Payment claims" subtitle="Parents who say they have paid" onClose={onClose}>
      {!rows && !err && <p className="muted">Loading…</p>}
      {err && <p className="notice">{err}</p>}
      {rows && !rows.length && <p className="muted">Nothing to check. When a parent taps “I’ve paid” in Telegram, it shows up here.</p>}
      <p className="muted small" style={{ margin: '0 0 10px' }}>
        {rows?.length ? 'Check your bank or UPI first. Nothing is marked paid until you record it.' : ''}
      </p>
      {rows?.map((c) => {
        const s = students.find((x) => x.id === c.student_id);
        const months = c.months ? c.months.split(',') : [];
        return (
          <div key={c.id} className="thread" style={{ padding: 14 }}>
            <b>{s?.name || 'Student'}</b> <small className="muted">· {c.chat_name || 'Parent'}</small>
            <div className="small" style={{ margin: '4px 0 8px' }}>
              {months.length ? `${monthsText(months)} · ${rupees(c.amount)}` : 'Fee'} · {when(c.created_at)}
            </div>
            {c.proof_path &&
              (shots[c.id] ? (
                <a href={shots[c.id]} target="_blank" rel="noreferrer">
                  <img src={shots[c.id]} alt="Payment screenshot" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10, marginBottom: 8 }} />
                </a>
              ) : (
                <button className="btn secondary" type="button" onClick={() => show(c)} style={{ marginBottom: 8, width: '100%' }}>
                  View screenshot
                </button>
              ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" type="button" style={{ flex: 1 }} onClick={() => onRecord(c, months[0])} disabled={!s}>
                Record payment
              </button>
              <button className="btn secondary" type="button" onClick={() => dismiss(c)}>
                Dismiss
              </button>
            </div>
          </div>
        );
      })}
    </Sheet>
  );
}
