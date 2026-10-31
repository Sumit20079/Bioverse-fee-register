import MonthNav from './MonthNav';
import { Icon } from './Icons';
import { monthLabel } from '../lib/dates';
import { rupees } from '../lib/format';

export default function Overview({ view, month, setMonth, isDemo, onOpenBatch, onNewBatch, onImport, onReport, onSignOut }) {
  const pct = view.expected > 0 ? Math.min(100, Math.round((view.collected / view.expected) * 100)) : 0;

  return (
    <>
      <header className="head">
        <div>
          <div className="kicker">Fee register</div>
          <h1>{monthLabel(month)}</h1>
        </div>
        <MonthNav month={month} onChange={setMonth} />
      </header>

      {isDemo && (
        <p className="banner" role="note" style={{ marginTop: 8 }}>
          Demo mode: sample data, saved only in this browser.
        </p>
      )}

      <section className="hero">
        <div>
          <div className="label">Collected this month</div>
          <div className="big">{rupees(view.collected)}</div>
          <div className="sub">of {rupees(view.expected)} expected</div>
        </div>
        <div className="bar" role="img" aria-label={`${pct}% collected`}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="stats">
          <span>{view.paidCount} paid</span>
          <span>{view.dueCount} due</span>
          <span>{rupees(view.pending)} pending</span>
        </div>
      </section>

      <div className="section-title">
        <h2>Batches</h2>
        <span>Fee is set per batch</span>
      </div>

      {view.batches.length === 0 ? (
        <div className="card empty" style={{ marginInline: 20 }}>
          <p>No batches yet. Create one with its monthly fee, then add students.</p>
          <button className="sbtn primary" onClick={onNewBatch}>
            <Icon.Plus /> New batch
          </button>
        </div>
      ) : (
        <div className="stack pad">
          {view.batches.map((v) => (
            <button key={v.batch.id} className="card batch-card" onClick={() => onOpenBatch(v.batch.id)}>
              <div className="top">
                <div>
                  <div className="name">{v.batch.name}</div>
                  <div className="meta">
                    {rupees(v.batch.fee)} / month · {v.total} student{v.total === 1 ? '' : 's'}
                  </div>
                </div>
                <Icon.Right />
              </div>
              <div className="progress">
                <i style={{ width: `${v.total ? (v.paidCount / v.total) * 100 : 0}%` }} />
              </div>
              <div className="foot">
                <span>
                  {v.paidCount} of {v.total} paid
                </span>
                <b>{rupees(v.collected)} collected</b>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="section-title">
        <h2>Tools</h2>
      </div>
      <div className="tools">
        <button className="tool" onClick={onReport}>
          <Icon.Download /> Monthly report
        </button>
        <button className="tool" onClick={onImport} disabled={!view.batches.length}>
          <Icon.Upload /> Import students
        </button>
        {!isDemo && (
          <button className="tool" onClick={onSignOut}>
            <Icon.Out /> Sign out
          </button>
        )}
      </div>
    </>
  );
}
