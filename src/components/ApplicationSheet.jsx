import { useState } from 'react';
import Sheet from './Sheet';
import { Icon } from './Icons';
import { ago, mainParent, marksheetUrl, resultText, STATUS_LABEL } from '../lib/admissions';
import { telLink, waLink } from '../lib/format';

const pretty = (p) => {
  const d = String(p || '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : p || '';
};

export default function ApplicationSheet({ app: a, dup, onClose, onStatus, onNote, onEdit, onEnroll, onFollow, onDelete, flash }) {
  const [note, setNote] = useState(a.notes || '');
  const [file, setFile] = useState('');
  const [opening, setOpening] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const mp = mainParent(a);
  const call = telLink(mp.phone);
  const wa = waLink(mp.phone, `Hello, this is Bio-Verse regarding ${a.student_name}'s admission (${a.admission_id}).`);

  const openSheet = async () => {
    setOpening(true);
    try {
      setFile(await marksheetUrl(a.marksheet_path));
    } catch {
      flash('Couldn’t open the file. Check your internet.');
    }
    setOpening(false);
  };

  const rows = (list) =>
    list
      .filter(([, v]) => v)
      .map(([k, v]) => (
        <div key={k} className="adm-row">
          <span className="k">{k}</span>
          <span className="v">{v}</span>
        </div>
      ));
  // name, phone and profession each on their own line, so a phone number is never split across two lines
  const parent = (name, phone, job) =>
    name || phone || job ? (
      <span className="adm-lines">
        {name && <span>{name}</span>}
        {phone && <span className="nw">{pretty(phone)}</span>}
        {job && <span className="muted">{job}</span>}
      </span>
    ) : null;
  const careers = [...(a.careers || []).filter((c) => c !== 'Other'), a.career_other ? `Other: ${a.career_other}` : a.careers?.includes('Other') ? 'Other' : ''].filter(Boolean).join(', ');

  const remove = async () => {
    setBusy(true);
    const ok = await onDelete();
    if (!ok) setBusy(false);
  };

  if (confirming) {
    return (
      <Sheet title="Delete this application?" onClose={onClose}>
        <p role="alert">
          <b>{a.student_name}</b> ({a.admission_id}) will move to Recently deleted (Settings). You can restore it from there.
          {a.status === 'enrolled' ? ' The student stays in the fee register.' : ''}
        </p>
        <p className="hint">If they just aren’t joining, cancel and mark them Dropped instead. That keeps the record.</p>
        <button type="button" className="btn" style={{ background: 'var(--danger)' }} disabled={busy} onClick={remove}>
          Yes, delete application
        </button>
        <button type="button" className="btn secondary" disabled={busy} onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title={a.student_name} subtitle={`${a.admission_id} · ${ago(a.created_at)}`} onClose={onClose}>
      {dup && <p className="notice">Possible duplicate: another application or a student in the fee register has the same phone number, or the same name and school.</p>}

      <div className="adm-call">
        <a className="sbtn primary" href={call || undefined}>
          <Icon.Phone /> Call {mp.role.toLowerCase()}
        </a>
        <a className="sbtn" href={wa || undefined} target="_blank" rel="noreferrer">
          <Icon.Chat /> WhatsApp
        </a>
      </div>

      <div className="field">
        <span className="lbl">Status</span>
        {a.status === 'enrolled' ? (
          <div className="adm-seg">
            <span className="adm-status enrolled big">Enrolled</span>
          </div>
        ) : (
          <div className="adm-seg">
            {['new', 'counselled', 'dropped'].map((s) => (
              <button key={s} type="button" className={'chip' + (a.status === s ? ' on' : '')} aria-pressed={a.status === s} onClick={() => a.status !== s && onStatus(s)}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      {(a.wants_counselling || a.wants_scholarship) && (
        <div className="field">
          <span className="lbl">Follow-up</span>
          {a.wants_counselling && (
            <label className="check">
              <input type="checkbox" checked={!!a.counselling_done} onChange={(e) => onFollow({ counselling_done: e.target.checked })} />
              Counselling done
            </label>
          )}
          {a.wants_scholarship && (
            <label className="check">
              <input type="checkbox" checked={!!a.scholarship_done} onChange={(e) => onFollow({ scholarship_done: e.target.checked })} />
              Scholarship test done
            </label>
          )}
        </div>
      )}

      <div className="card adm-detail">
        <h3>Student</h3>
        {rows([
          ['Class', a.class],
          ['Gender', a.gender],
          ['Board', a.board],
          ['School', a.school],
          ['Preferred batch', a.batch_location],
          ['WhatsApp', a.student_phone && <span className="nw">{pretty(a.student_phone)}</span>],
          ['Email', a.student_email && (() => { const [u, d] = a.student_email.split('@'); return d ? <span>{u}<wbr />@<span className="nw">{d}</span></span> : a.student_email; })()],
          ['Address', a.address],
          ['Blood group', a.blood_group],
          ['Hobby', a.hobby],
        ])}
        <h3>Parents</h3>
        {rows([
          ['Father', parent(a.father_name, a.father_phone, a.father_profession)],
          ['Mother', parent(a.mother_name, a.mother_phone, a.mother_profession)],
          ['Main contact', mp.role],
        ])}
        <h3>Academics</h3>
        {rows([
          ['Result', resultText(a)],
          ['Expected result', a.result_expectation],
        ])}
        <div className="adm-row">
          <span className="k">Marksheet</span>
          <span className="v">
            {!a.marksheet_path && 'Not added'}
            {a.marksheet_path && !file && (
              <button type="button" className="adm-link" onClick={openSheet} disabled={opening}>
                {opening ? 'Opening…' : 'View file'}
              </button>
            )}
            {file && (
              <a className="adm-link" href={file} target="_blank" rel="noreferrer">
                Open file
              </a>
            )}
          </span>
        </div>
        <h3>Preferences</h3>
        {rows([
          ['Career interest', careers],
          ['Referred from', a.referred_from],
          ['Counselling', a.wants_counselling ? 'Yes' : 'No'],
          ['Scholarship test', a.wants_scholarship ? 'Yes' : 'No'],
        ])}
      </div>

      <div className="field">
        <label htmlFor="adm-note">Notes</label>
        <textarea id="adm-note" rows={3} placeholder="Add a note about this applicant" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (a.notes || '') && onNote(note)} />
      </div>

      <button type="button" className="btn" onClick={onEnroll} disabled={a.status === 'enrolled'}>
        {a.status === 'enrolled' ? 'Already enrolled' : 'Enroll'}
      </button>
      <button type="button" className="btn secondary" onClick={onEdit}>
        Edit details
      </button>
      <button type="button" className="btn danger" onClick={() => setConfirming(true)}>
        Delete application
      </button>
    </Sheet>
  );
}
