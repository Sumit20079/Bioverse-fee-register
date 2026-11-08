import { useEffect, useState } from 'react';
import Sheet from './Sheet';
import { DEFAULT_REMINDER, fillTemplate } from '../lib/format';
import { loadLinked, loadSettings, saveSettings, sendNow, teacherLink } from '../lib/telegram';

const MODES = [
  ['manual', 'Only when I tap'],
  ['once', 'Once a month'],
  ['repeat', 'Keep repeating'],
];

export default function RemindersSheet({ onClose, onChanged, flash }) {
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  const [linked, setLinked] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [settings, l] = await Promise.all([loadSettings(), loadLinked()]);
        if (!live) return;
        setS(settings);
        setLinked(l.linked.size);
        if (!l.ready) setErr('Telegram isn’t set up in the database yet. Run supabase/add-telegram.sql in Supabase first.');
      } catch {
        if (live) setErr('Couldn’t load. You need internet here, and the Telegram tables must exist in Supabase (supabase/add-telegram.sql).');
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const set = (patch) => setS((x) => ({ ...x, ...patch }));
  const save = async () => {
    setBusy(true);
    try {
      await saveSettings(s);
      flash('Reminder settings saved');
      onChanged?.();
    } catch (e) {
      flash(`Couldn’t save: ${e.message}`);
    }
    setBusy(false);
  };
  const send = async () => {
    setBusy(true);
    setResult('');
    try {
      await saveSettings(s); // so the wording you see is the wording sent
      const r = await sendNow();
      setResult(
        r.sent
          ? `Sent to ${r.sent} parent${r.sent === 1 ? '' : 's'}${r.failed ? `, ${r.failed} failed` : ''}${r.skipped ? `. ${r.skipped} skipped (already reminded today)` : ''}.`
          : r.skipped
            ? `Nothing sent: ${r.skipped} student${r.skipped === 1 ? ' was' : 's were'} already reminded today.`
            : 'Nothing to send: no connected parent has anything pending.',
      );
    } catch (e) {
      setResult(`Couldn’t send: ${e.message}`);
    }
    setBusy(false);
  };

  const connectMe = async () => {
    setBusy(true);
    try {
      await saveSettings(s); // makes sure the settings row (and its private link) exists
      const fresh = await loadSettings();
      set({ teacher_token: fresh.teacher_token, teacher_chat_id: fresh.teacher_chat_id });
      const link = teacherLink(fresh.teacher_token);
      if (link) window.open(link, '_blank', 'noopener');
      else flash('Couldn’t make the link. Is the database updated?');
    } catch (e) {
      flash(`Couldn’t connect: ${e.message}`);
    }
    setBusy(false);
  };
  const recheck = async () => {
    try {
      const fresh = await loadSettings();
      set({ teacher_chat_id: fresh.teacher_chat_id });
      flash(fresh.teacher_chat_id ? 'Your Telegram is connected' : 'Not connected yet. Press Start in the bot first.');
    } catch {
      flash('Couldn’t check. Are you online?');
    }
  };

  const sample = fillTemplate(s?.message, { name: 'Asha', amount: 1500, monthsLabel: 'Oct, Nov', batchName: 'Class 10' });

  return (
    <Sheet title="Telegram reminders" subtitle="Free, automatic, for parents who connect" onClose={onClose}>
      {!s && !err && <p className="muted">Loading…</p>}
      {err && <p className="notice">{err}</p>}
      {s && (
        <>
          <p className="muted small" style={{ margin: '0 0 10px' }}>
            {linked
              ? `${linked} student${linked === 1 ? ' has' : 's have'} a parent connected. Parents who aren’t on Telegram still get the WhatsApp button on the Due tab.`
              : 'No parent is connected yet. Open a student and tap “Invite on Telegram” to send them their link.'}
          </p>

          <div className="field">
            <span className="lbl">When to send</span>
            <div className="seg" role="radiogroup" aria-label="When to send">
              {MODES.map(([id, name]) => (
                <button key={id} type="button" role="radio" aria-checked={s.mode === id} className={s.mode === id ? 'on' : ''} onClick={() => set({ mode: id })}>
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className={'collapse' + (s.mode !== 'manual' ? ' open' : '')}>
            <div className="collapse-in">
              <div className="field">
                <label htmlFor="rm-day">{s.mode === 'once' ? 'Day of the month' : 'Start on day'}</label>
                <input id="rm-day" type="number" inputMode="numeric" min="1" max="31" value={s.day} onChange={(e) => set({ day: e.target.value })} />
              </div>
              <div className={'collapse' + (s.mode === 'repeat' ? ' open' : '')}>
                <div className="collapse-in">
                  <div className="field">
                    <label htmlFor="rm-every">Then again every (days)</label>
                    <input id="rm-every" type="number" inputMode="numeric" min="1" max="30" value={s.every_days} onChange={(e) => set({ every_days: e.target.value })} />
                  </div>
                </div>
              </div>
              <p className="muted small" style={{ margin: '0 0 10px' }}>
                {s.mode === 'once' ? `Every month on day ${s.day}` : `From day ${s.day} of each month, every ${s.every_days} days`}, at about 9 am, parents who owe money get a message. Paid-up students are never messaged.
              </p>
            </div>
          </div>

          <div className="field">
            <label htmlFor="rm-msg">Message (optional)</label>
            <textarea id="rm-msg" rows="4" placeholder={DEFAULT_REMINDER} value={s.message} onChange={(e) => set({ message: e.target.value })} />
            <p className="hint">Use {'{name}'} {'{amount}'} {'{months}'} {'{batch}'} and they are filled in for each student.</p>
          </div>
          <div className="notice" style={{ marginBottom: 12 }}>
            <b>Preview</b>
            <div className="small" style={{ marginTop: 4 }}>{sample}</div>
          </div>

          <div className="field">
            <label htmlFor="rm-warn">Heads-up before the day</label>
            <select id="rm-warn" value={s.warn_days || 0} disabled={s.mode === 'manual'} onChange={(e) => set({ warn_days: Number(e.target.value) })}>
              <option value={0}>Off</option>
              {[1, 2, 3, 5, 7].map((n) => (
                <option key={n} value={n}>
                  {n} day{n === 1 ? '' : 's'} before
                </option>
              ))}
            </select>
            <p className="hint">{s.mode === 'manual' ? 'Pick “Once a month” or “Keep repeating” above to use this.' : 'A soft “fee is due soon” message to parents whose child has not paid this month.'}</p>
          </div>

          <div className="notice" style={{ marginBottom: 12 }}>
            <b>Updates to you</b>
            <div className="small" style={{ margin: '4px 0 8px' }}>
              {s.teacher_chat_id ? 'Your Telegram is connected.' : 'Connect your own Telegram to get a message when a parent connects, and a monthly summary.'}
            </div>
            {!s.teacher_chat_id ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn secondary" type="button" disabled={busy} onClick={connectMe}>
                  Connect my Telegram
                </button>
                {s.teacher_token && (
                  <button className="btn secondary" type="button" onClick={recheck}>
                    I pressed Start
                  </button>
                )}
              </div>
            ) : (
              <>
                <label className="check" style={{ marginBottom: 6 }}>
                  <input type="checkbox" checked={s.notify_connect !== false} onChange={(e) => set({ notify_connect: e.target.checked })} />
                  <span>Tell me when a parent connects</span>
                </label>
                <label className="check">
                  <input type="checkbox" checked={!!s.summary} onChange={(e) => set({ summary: e.target.checked })} />
                  <span>Send me last month’s summary on the 1st</span>
                </label>
              </>
            )}
          </div>

          <label className="check" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={s.receipts !== false} onChange={(e) => set({ receipts: e.target.checked })} />
            <span>Send a “payment received” message when I record a payment</span>
          </label>

          <button className="btn" disabled={busy} onClick={save}>
            Save
          </button>
          <button className="btn secondary" disabled={busy || !linked} onClick={send} style={{ marginTop: 8 }}>
            Send reminders now
          </button>
          {result && (
            <p className="small" role="status" style={{ marginTop: 10 }}>
              {result}
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}
