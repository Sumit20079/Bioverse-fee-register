import { useMemo, useState } from 'react';
import SettingsBtn from './SettingsBtn';
import { Icon } from './Icons';
import { ago, copyText, counsellingPending, FORM_URL, formShareText, shareForm, mainParent, resultText, scholarshipPending, STATUS_LABEL } from '../lib/admissions';
import { telLink, waLink } from '../lib/format';

const CLASSES = ['5', '6', '7', '8', '9', '10', '11', '12', 'Dropper', '11+NEET', '12+NEET'];
const LOCATIONS = ['Habra', 'Jaguli', 'Haringhata', 'Gobardanga', 'Nahata'];
const FILTERS = [
  ['all', 'All'],
  ['new', 'New'],
  ['counselled', 'Counselled'],
  ['enrolled', 'Enrolled'],
  ['dropped', 'Dropped'],
];

function FormLink({ flash }) {
  const copy = async () => flash((await copyText(FORM_URL)) ? 'Link copied' : 'Couldn’t copy. Press and hold the link to copy it.');
  const share = async () => {
    const r = await shareForm();
    // no share sheet on this device (e.g. a laptop): open WhatsApp with the message ready instead
    if (r === 'unsupported') window.open(`https://wa.me/?text=${encodeURIComponent(formShareText())}`, '_blank', 'noopener');
  };
  return (
    <div className="card form-link">
      <div className="lbl">Admission form for students</div>
      <a className="copy url" href={FORM_URL} target="_blank" rel="noreferrer">
        {FORM_URL.replace(/^https?:\/\//, '')}
      </a>
      <div className="adm-call">
        <button type="button" className="sbtn" onClick={copy}>
          <Icon.Copy /> Copy link
        </button>
        <button type="button" className="sbtn primary" onClick={share}>
          <Icon.Share /> Share
        </button>
      </div>
    </div>
  );
}

export default function Admissions({ apps, error, dups, onCsv, onRetry, onBack, onOpen, flash }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [cls, setCls] = useState('');
  const [loc, setLoc] = useState('');
  const [sort, setSort] = useState('new');
  const [follow, setFollow] = useState('');

  const counts = useMemo(() => {
    const c = { all: 0, new: 0, counselled: 0, enrolled: 0, dropped: 0 };
    for (const a of apps || []) {
      c.all += 1;
      c[a.status] += 1;
    }
    return c;
  }, [apps]);

  const followCounts = useMemo(() => {
    let coun = 0;
    let schol = 0;
    for (const a of apps || []) {
      if (counsellingPending(a)) coun += 1;
      if (scholarshipPending(a)) schol += 1;
    }
    return { coun, schol };
  }, [apps]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = (apps || []).filter(
      (a) =>
        (filter === 'all' || a.status === filter) &&
        (!cls || a.class === cls) &&
        (!loc || a.batch_location === loc) &&
        (!follow || (follow === 'coun' ? counsellingPending(a) : scholarshipPending(a))) &&
        (!needle || `${a.student_name} ${a.school} ${a.admission_id}`.toLowerCase().includes(needle)),
    );
    if (sort === 'pct') list = [...list].sort((x, y) => Number(y.result_percent) - Number(x.result_percent));
    return list;
  }, [apps, filter, q, cls, loc, sort, follow]);

  return (
    <>
      <header className="head">
        <div className="back">
          <button className="iconbtn" aria-label="Back" onClick={onBack}>
            <Icon.Left />
          </button>
          <div>
            <div className="kicker">Fee register</div>
            <h1>Admissions</h1>
          </div>
        </div>
        <SettingsBtn />
      </header>

      <div style={{ padding: '0 20px' }}>
        <FormLink flash={flash} />
        {apps && apps.length > 0 && (
          <button type="button" className="sbtn" style={{ marginTop: 10 }} onClick={onCsv}>
            Download as spreadsheet (CSV)
          </button>
        )}
      </div>

      {error && (
        <div className="card empty" style={{ marginInline: 20, marginTop: 12 }}>
          <p>{error}</p>
          <button className="sbtn primary" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
      {!apps && !error && <p className="muted" style={{ padding: '16px 20px' }}>Loading…</p>}

      {apps && (
        <>
          <div className="chips">
            {FILTERS.map(([k, label]) => (
              <button key={k} className={'chip' + (filter === k ? ' on' : '')} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {label} {counts[k]}
              </button>
            ))}
          </div>

          <label className="searchbar">
            <Icon.Search width={20} height={20} />
            <input type="search" aria-label="Search applicants" placeholder="Search name, school or ID" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>

          <div className="adm-filters">
            <select aria-label="Class" value={cls} onChange={(e) => setCls(e.target.value)}>
              <option value="">All classes</option>
              {CLASSES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select aria-label="Batch location" value={loc} onChange={(e) => setLoc(e.target.value)}>
              <option value="">All locations</option>
              {LOCATIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select aria-label="Follow-up" value={follow} onChange={(e) => setFollow(e.target.value)}>
              <option value="">Follow-up: all</option>
              <option value="coun">Counselling due ({followCounts.coun})</option>
              <option value="schol">Test due ({followCounts.schol})</option>
            </select>
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="new">Newest first</option>
              <option value="pct">Highest result first</option>
            </select>
          </div>

          <div className="stack pad adm-list">
            {rows.map((a) => {
              const mp = mainParent(a);
              const call = telLink(mp.phone);
              const wa = waLink(mp.phone, `Hello, this is Bio-Verse regarding ${a.student_name}'s admission (${a.admission_id}).`);
              return (
                <div key={a.id} className="card adm-card">
                  <button className="adm-open" onClick={() => onOpen(a.id)}>
                    <span className="adm-top">
                      <b className="adm-name">{a.student_name}</b>
                      <span className={`adm-status ${a.status}`}>{STATUS_LABEL[a.status]}</span>
                    </span>
                    <span className="adm-line">
                      Class {a.class} · {a.board} · {a.school}
                    </span>
                    <span className="adm-meta">
                      {a.batch_location} · {ago(a.created_at)} · {resultText(a)}
                    </span>
                    {(a.wants_counselling || a.wants_scholarship || dups.has(a.id)) && (
                      <span className="adm-tags">
                        {a.wants_counselling && (a.counselling_done ? <span className="adm-tag done">Counselling done</span> : <span className="adm-tag coun">Wants counselling</span>)}
                        {a.wants_scholarship && (a.scholarship_done ? <span className="adm-tag done">Scholarship test done</span> : <span className="adm-tag schol">Scholarship test</span>)}
                        {dups.has(a.id) && <span className="adm-tag dup">Possible duplicate</span>}
                      </span>
                    )}
                  </button>
                  <div className="adm-actions">
                    <a className="sbtn" href={call || undefined} aria-label={`Call ${mp.role.toLowerCase()}`}>
                      <Icon.Phone /> Call
                    </a>
                    <a className="sbtn" href={wa || undefined} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${mp.role.toLowerCase()}`}>
                      <Icon.Chat /> WhatsApp
                    </a>
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && (
              <p className="muted" style={{ textAlign: 'center', padding: '28px 0' }}>
                {apps.length === 0 ? 'No applications yet. When someone fills in the admission form, it shows up here.' : 'No applicants match these filters.'}
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}
