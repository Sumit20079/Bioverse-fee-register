import { useEffect, useMemo, useState } from 'react';
import Sheet from './Sheet';
import { createExam, deleteExam, getResultsAuto, loadExams, loadMarks, loadMarksFor, saveMarks, sendResults, setResultsAuto } from '../lib/exams';
import { examStats, num, pct } from '../lib/marks';
import { todayISO, dateLabel } from '../lib/dates';

export default function ExamsSheet({ onClose, batch, students, flash }) {
  const [exams, setExams] = useState(null);
  const [stats, setStats] = useState({});
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', total: '', held_on: todayISO() });
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const list = await loadExams(batch.id);
      setExams(list);
      const marks = await loadMarksFor(list.map((e) => e.id));
      const by = {};
      for (const e of list) by[e.id] = examStats(marks.filter((m) => m.exam_id === e.id));
      setStats(by);
    } catch {
      setErr('Couldn’t load tests. You need internet, and the tests tables must exist in Supabase.');
    }
  };
  useEffect(() => {
    load();
    getResultsAuto().then(setAuto).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAuto = async (on) => {
    setAuto(on);
    try {
      await setResultsAuto(on);
    } catch {
      flash('Couldn’t save that setting');
      setAuto(!on);
    }
  };

  const formOk = form.name.trim() && Number(form.total) > 0 && form.held_on;
  const add = async () => {
    setBusy(true);
    try {
      const e = await createExam(batch.id, form);
      setForm({ name: '', total: '', held_on: todayISO() });
      setAdding(false);
      await load();
      setOpen(e);
    } catch (e) {
      flash(`Couldn’t add: ${e.message}`);
    }
    setBusy(false);
  };

  if (open) {
    return <Entry exam={open} batch={batch} students={students} auto={auto} flash={flash} onClose={onClose} onBack={() => { setOpen(null); load(); }} />;
  }

  return (
    <Sheet title="Tests" subtitle={`${batch.name} · marks and results`} onClose={onClose}>
      {err && <p className="notice">{err}</p>}
      {!exams && !err && <p className="muted">Loading…</p>}

      <div className="field">
        <span className="lbl">Send results to parents</span>
        <div className="seg" role="radiogroup" aria-label="Send results to parents">
          <button type="button" role="radio" aria-checked={!auto} className={!auto ? 'on' : ''} onClick={() => toggleAuto(false)}>
            When I tap
          </button>
          <button type="button" role="radio" aria-checked={auto} className={auto ? 'on' : ''} onClick={() => toggleAuto(true)}>
            Automatically
          </button>
        </div>
        <p className="hint">{auto ? 'Results go out as soon as you save the marks.' : 'You check the marks first, then tap “Send results”.'}</p>
      </div>

      {!adding ? (
        <button className="btn" onClick={() => setAdding(true)} style={{ marginBottom: 12 }}>
          New test
        </button>
      ) : (
        <div className="notice" style={{ marginBottom: 12 }}>
          <div className="field">
            <label htmlFor="ex-name">Test name</label>
            <input id="ex-name" placeholder="e.g. Unit test 1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ex-total">Total marks</label>
            <input id="ex-total" inputMode="decimal" placeholder="e.g. 50" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value.replace(/[^\d.]/g, '') })} />
          </div>
          <div className="field">
            <label htmlFor="ex-date">Date</label>
            <input id="ex-date" type="date" value={form.held_on} onChange={(e) => setForm({ ...form, held_on: e.target.value })} />
          </div>
          <button className="btn" disabled={!formOk || busy} onClick={add}>
            Add test
          </button>
          <button className="btn secondary" style={{ marginTop: 8 }} onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      )}

      {exams && !exams.length && !adding && <p className="muted">No tests yet. Add one, then type each student’s marks.</p>}
      {exams?.map((e) => {
        const st = stats[e.id];
        return (
          <button key={e.id} type="button" className="thread-head thread" style={{ display: 'flex', width: '100%' }} onClick={() => setOpen(e)}>
            <span>
              <b>{e.name}</b> <small>· {dateLabel(e.held_on)}</small>
              <small>
                Out of {num(e.total)} · {st?.count ? `${st.count} marked · average ${num(st.average)} · highest ${num(st.highest)}` : 'no marks yet'}
              </small>
            </span>
          </button>
        );
      })}
    </Sheet>
  );
}

function Entry({ exam, batch, students, auto, flash, onClose, onBack }) {
  const roster = useMemo(() => students.filter((s) => s.batch_id === batch.id && s.active).sort((a, b) => a.name.localeCompare(b.name)), [students, batch.id]);
  const [draft, setDraft] = useState(null); // student id -> { score: '', absent: false }
  const [saved, setSaved] = useState({}); // what is in the database (to know what changed / was sent)
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    loadMarks(exam.id)
      .then((rows) => {
        const d = {};
        const sv = {};
        for (const s of roster) d[s.id] = { score: '', absent: false };
        for (const m of rows) {
          d[m.student_id] = { score: m.score === null ? '' : String(Number(m.score)), absent: m.absent };
          sv[m.student_id] = m;
        }
        setDraft(d);
        setSaved(sv);
      })
      .catch(() => setResult('Couldn’t load the marks. Are you online?'));
  }, [exam.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = Number(exam.total);
  const bad = (id) => {
    const v = draft?.[id];
    if (!v || v.absent || v.score === '') return false;
    const n = Number(v.score);
    return !Number.isFinite(n) || n < 0 || n > total;
  };
  const anyBad = roster.some((s) => bad(s.id));
  const live = useMemo(() => (draft ? examStats(roster.map((s) => ({ student_id: s.id, score: draft[s.id].score === '' ? null : draft[s.id].score, absent: draft[s.id].absent }))) : null), [draft, roster]);
  const set = (id, patch) => setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const pending = roster.filter((s) => {
    const m = saved[s.id];
    return m && !m.absent && m.score !== null && (!m.sent_at || Number(m.sent_score) !== Number(m.score));
  }).length;

  const save = async () => {
    setBusy(true);
    setResult('');
    try {
      const keep = [];
      const clear = [];
      for (const s of roster) {
        const v = draft[s.id];
        if (v.absent) keep.push({ student_id: s.id, score: null, absent: true });
        else if (v.score !== '') keep.push({ student_id: s.id, score: Number(v.score), absent: false });
        else if (saved[s.id]) clear.push(s.id);
      }
      await saveMarks(exam.id, keep, clear);
      let msg = 'Marks saved.';
      if (auto) {
        const r = await sendResults(exam.id);
        msg += r.sent ? ` Results sent to ${r.sent} parent${r.sent === 1 ? '' : 's'}.` : ' No connected parent to send to.';
      }
      setResult(msg);
      const fresh = await loadMarks(exam.id);
      const sv = {};
      for (const m of fresh) sv[m.student_id] = m;
      setSaved(sv);
    } catch (e) {
      setResult(`Couldn’t save: ${e.message}`);
    }
    setBusy(false);
  };

  const send = async () => {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    setBusy(true);
    try {
      const r = await sendResults(exam.id);
      setResult(r.sent ? `Results sent to ${r.sent} parent${r.sent === 1 ? '' : 's'}${r.failed ? `, ${r.failed} failed` : ''}.` : 'Nobody to send to: no connected parent has a new result.');
      const fresh = await loadMarks(exam.id);
      const sv = {};
      for (const m of fresh) sv[m.student_id] = m;
      setSaved(sv);
    } catch (e) {
      setResult(`Couldn’t send: ${e.message}`);
    }
    setArmed(false);
    setBusy(false);
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${exam.name}” and all its marks?`)) return;
    try {
      await deleteExam(exam.id);
      flash('Test deleted');
      onBack();
    } catch (e) {
      flash(`Couldn’t delete: ${e.message}`);
    }
  };

  return (
    <Sheet title={exam.name} subtitle={`${batch.name} · out of ${num(exam.total)}`} onClose={onClose}>
      <button className="chip" type="button" onClick={onBack} style={{ marginBottom: 10 }}>
        ← All tests
      </button>
      {!draft && <p className="muted">Loading…</p>}
      {draft && (
        <>
          <p className="muted small" style={{ margin: '0 0 10px' }}>
            {live.count ? `${live.count} marked · average ${num(live.average)} · highest ${num(live.highest)}` : 'Type each student’s marks. Tick Absent for anyone who missed it.'}
          </p>
          {roster.map((s) => {
            const v = draft[s.id];
            const r = live.rank.get(s.id);
            return (
              <div key={s.id} className="markrow">
                <span className="markname">
                  <b>{s.name}</b>
                  {r && !v.absent && !bad(s.id) && (
                    <small>
                      Rank {r} · {pct(v.score, total)}%
                    </small>
                  )}
                </span>
                <input
                  className={'markin' + (bad(s.id) ? ' bad' : '')}
                  inputMode="decimal"
                  aria-label={`Marks for ${s.name}`}
                  placeholder={v.absent ? 'Absent' : `/ ${num(total)}`}
                  disabled={v.absent}
                  value={v.absent ? '' : v.score}
                  onChange={(e) => set(s.id, { score: e.target.value.replace(/[^\d.]/g, '') })}
                />
                <label className="markabs">
                  <input type="checkbox" checked={v.absent} onChange={(e) => set(s.id, { absent: e.target.checked, score: '' })} /> Abs
                </label>
              </div>
            );
          })}
          {anyBad && <p className="notice">Some marks are higher than the total. Fix the red boxes first.</p>}
          <button className="btn" disabled={busy || anyBad} onClick={save} style={{ marginTop: 12 }}>
            {busy ? 'Working…' : auto ? 'Save and send results' : 'Save marks'}
          </button>
          {!auto && (
            <button className="btn secondary" disabled={busy || !pending} onClick={send} style={{ marginTop: 8 }}>
              {armed ? 'Tap again to send' : pending ? `Send results (${pending} new)` : 'Send results (nothing new)'}
            </button>
          )}
          {result && (
            <p className="small" role="status" style={{ marginTop: 10 }}>
              {result}
            </p>
          )}
          <button className="chip" type="button" onClick={remove} style={{ marginTop: 16 }}>
            Delete this test
          </button>
        </>
      )}
    </Sheet>
  );
}
