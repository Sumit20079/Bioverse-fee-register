import { useEffect, useMemo, useState } from 'react';
import Sheet from './Sheet';
import { loadMessages, markRead, sendReply } from '../lib/telegram';

const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function MessagesSheet({ onClose, students, flash }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setRows(await loadMessages());
    } catch {
      setErr('Couldn’t load messages. You need internet, and the messages table must exist in Supabase.');
    }
  };
  useEffect(() => {
    load();
  }, []);

  const name = (id) => students.find((s) => s.id === id)?.name || 'Student';
  const threads = useMemo(() => {
    const by = new Map();
    for (const m of rows || []) {
      const k = `${m.chat_id}|${m.student_id}`;
      if (!by.has(k)) by.set(k, { key: k, last: m, items: [], unread: 0 });
      const t = by.get(k);
      t.items.push(m);
      if (m.direction === 'in' && !m.read) t.unread += 1;
    }
    return [...by.values()].map((t) => ({ ...t, items: [...t.items].reverse() }));
  }, [rows]);

  const toggle = async (t) => {
    setReply('');
    if (open === t.key) return setOpen(null);
    setOpen(t.key);
    const ids = t.items.filter((m) => m.direction === 'in' && !m.read).map((m) => m.id);
    if (ids.length) {
      setRows((r) => r.map((m) => (ids.includes(m.id) ? { ...m, read: true } : m)));
      markRead(ids).catch(() => {});
    }
  };

  const send = async (t) => {
    setBusy(true);
    try {
      await sendReply(t.last, reply);
      setReply('');
      flash('Reply sent');
      await load();
    } catch (e) {
      flash(`Couldn’t send: ${e.message}`);
    }
    setBusy(false);
  };

  return (
    <Sheet title="Parent messages" subtitle="What parents type to the bot" onClose={onClose}>
      {!rows && !err && <p className="muted">Loading…</p>}
      {err && <p className="notice">{err}</p>}
      {rows && !threads.length && <p className="muted">No messages yet. When a parent types to the bot, it shows up here.</p>}
      {threads.map((t) => (
        <div key={t.key} className="thread">
          <button type="button" className="thread-head" onClick={() => toggle(t)} aria-expanded={open === t.key}>
            <span>
              <b>{t.last.chat_name || 'Parent'}</b> <small>· {name(t.last.student_id)}</small>
              <small className="thread-last">{t.last.direction === 'out' ? 'You: ' : ''}{t.last.body}</small>
            </span>
            {t.unread > 0 && <i className="thread-dot" aria-label={`${t.unread} unread`} />}
          </button>
          {open === t.key && (
            <div className="thread-body">
              {t.items.map((m) => (
                <div key={m.id} className={'bubble ' + (m.direction === 'out' ? 'me' : 'them')}>
                  {m.body}
                  <small>{when(m.created_at)}</small>
                </div>
              ))}
              <div className="field" style={{ marginTop: 8 }}>
                <textarea rows="2" aria-label="Reply" placeholder="Reply on Telegram…" value={reply} maxLength={1000} onChange={(e) => setReply(e.target.value)} />
              </div>
              <button className="btn" style={{ width: "100%" }} disabled={busy || !reply.trim()} onClick={() => send(t)}>
                {busy ? 'Sending…' : 'Send reply'}
              </button>
            </div>
          )}
        </div>
      ))}
    </Sheet>
  );
}
