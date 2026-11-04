import SettingsBtn from './SettingsBtn';
import { useMemo, useState } from 'react';
import { Icon } from './Icons';
import { lean } from '../lib/lean';
import { KINDS, canGoNext, periodOf, step, summarise } from '../lib/collections';
import { dateLabel, monthShort, todayISO } from '../lib/dates';
import { rupees } from '../lib/format';
import { useCountUp } from '../lib/useCountUp';

const PAGE = 40;

export default function Collected({ data, onOpen }) {
  const [kind, setKind] = useState('day');
  const [anchor, setAnchor] = useState(todayISO());
  const [batchId, setBatchId] = useState('all');
  const [shown, setShown] = useState(PAGE);

  const period = useMemo(() => periodOf(kind, anchor), [kind, anchor]);
  const s = useMemo(() => summarise(data, period, batchId), [data, period, batchId]);
  const max = Math.max(1, ...s.buckets.map((b) => b.amount));
  const shownTotal = useCountUp(s.total);
  const motionKey = `${kind}-${anchor}-${batchId}`;
  const batchName = batchId === 'all' ? '' : data.batches.find((b) => b.id === batchId)?.name || '';
  const empty = kind === 'day' ? 'today' : kind === 'week' ? 'this week' : kind === 'month' ? 'this month' : 'this year';

  const pick = (k) => {
    setKind(k);
    setAnchor(todayISO());
    setShown(PAGE);
  };
  const move = (dir) => {
    setAnchor((a) => step(kind, a, dir));
    setShown(PAGE);
  };

  return (
    <>
      <header className="head">
        <div>
          <div className="kicker">Money in</div>
          <h1>Collected</h1>
        </div>
        <SettingsBtn />
      </header>

      <div className="per" role="group" aria-label="Period">
        {KINDS.map(([k, label]) => (
          <button key={k} className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => pick(k)}>
            {label}
          </button>
        ))}
      </div>

      <div className="pernav">
        <button className="iconbtn" aria-label="Earlier" onClick={(e) => { lean(e.currentTarget, -1); move(-1); }}>
          <Icon.Left width={22} height={22} />
        </button>
        <b>{period.label}</b>
        <button className="iconbtn" aria-label="Later" disabled={!canGoNext(kind, anchor)} onClick={(e) => { lean(e.currentTarget, 1); move(1); }}>
          <Icon.Right width={22} height={22} />
        </button>
      </div>

      {data.batches.length > 1 && (
        <div className="chips" role="group" aria-label="Batch">
          <button className={'chip' + (batchId === 'all' ? ' on' : '')} aria-pressed={batchId === 'all'} onClick={() => setBatchId('all')}>
            All batches
          </button>
          {data.batches.map((b) => (
            <button key={b.id} className={'chip' + (batchId === b.id ? ' on' : '')} aria-pressed={batchId === b.id} onClick={() => setBatchId(b.id)}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      <div className="card coll-hero">
        <div className="k">{batchName ? batchName : 'All batches'}</div>
        <div className="big" aria-live="polite">{rupees(shownTotal)}</div>
        <div className="k">
          {s.count} payment{s.count === 1 ? '' : 's'} received · {period.label.toLowerCase()}
        </div>
      </div>

      {s.buckets.length > 0 && s.total > 0 && (
        <div className="card bars" role="img" aria-label={`${period.label}: ${rupees(s.total)} collected`}>
          <div className="plot" key={motionKey}>
            {s.buckets.map((b, i) => (
              <div className="col" key={b.key} style={{ '--i': i }} title={`${kind === 'year' ? monthShort(b.key) : dateLabel(b.key)}: ${rupees(b.amount)}`}>
                <i style={{ height: `${Math.max(b.amount ? 4 : 0, (b.amount / max) * 100)}%` }} className={b.amount ? 'on' : ''} />
              </div>
            ))}
          </div>
          <div className="axis">
            {s.buckets.map((b, i) => (
              <span key={b.key}>{kind === 'month' && i % 5 !== 0 ? '' : b.label}</span>
            ))}
          </div>
        </div>
      )}

      {batchId === 'all' && s.batches.length > 0 && (
        <>
          <div className="section-title">
            <h2>By batch</h2>
          </div>
          <div className="list" key={`b-${motionKey}`}>
            {s.batches.map((e, i) => (
              <button className="row bybatch rise" style={{ '--i': i }} key={e.batch.id} onClick={() => setBatchId(e.batch.id)}>
                <span className="who">
                  <span className="n">{e.batch.name}</span>
                  <span className="d">
                    {e.count} payment{e.count === 1 ? '' : 's'}
                  </span>
                  <span className="share">
                    <i style={{ width: `${(e.amount / Math.max(1, s.batches[0].amount)) * 100}%` }} />
                  </span>
                </span>
                <b>{rupees(e.amount)}</b>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="section-title">
        <h2>Payments</h2>
        {s.rows.length > 0 && <span>{s.rows.length}</span>}
      </div>
      {s.rows.length === 0 ? (
        <div className="card empty" style={{ marginInline: 20 }}>
          <p>Nothing collected {empty}{batchName ? ` in ${batchName}` : ''}.</p>
        </div>
      ) : (
        <div className="list" key={`p-${motionKey}`}>
          {s.rows.slice(0, shown).map((r, i) => (
            <button className="row bybatch rise" style={{ '--i': i }} key={r.payment.id} onClick={() => onOpen(r.student, r.payment.month)}>
              <span className="who">
                <span className="n">{r.student.name}</span>
                <span className="d">
                  {r.batch?.name} · for {monthShort(r.payment.month)}
                  {kind !== 'day' ? ` · ${dateLabel(r.payment.paid_on)}` : ''}
                  {r.payment.note ? ` · ${r.payment.note}` : ''}
                </span>
              </span>
              <b>{rupees(r.payment.amount)}</b>
            </button>
          ))}
        </div>
      )}
      {s.rows.length > shown && (
        <div style={{ padding: '12px 20px' }}>
          <button className="btn secondary" style={{ width: '100%' }} onClick={() => setShown((n) => n + PAGE)}>
            Show more
          </button>
        </div>
      )}
    </>
  );
}
