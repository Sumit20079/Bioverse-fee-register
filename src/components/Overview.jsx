import SettingsBtn from './SettingsBtn';
import MonthNav from './MonthNav';
import Donut from './Donut';
import { Icon } from './Icons';
import { monthLabel } from '../lib/dates';
import { feeFor } from '../lib/calc';
import { rupees } from '../lib/format';
import { useCountUp } from '../lib/useCountUp';

export default function Overview({ view, month, setMonth, isDemo, onOpenBatch, onNewBatch, onImport, onReport, onBackup, onRestoreFile, onTrash, onAppearance, trashCount, onSignOut, onAdmissions, onAdmissionStats, onPaid, onDue, newApps }) {
  const shownCollected = useCountUp(view.collected);

  return (
    <>
      <header className="head">
        <div>
          <div className="kicker">Fee register</div>
          <h1>{monthLabel(month)}</h1>
        </div>
        <div className="navpair">
          <MonthNav month={month} onChange={setMonth} animate />
          <SettingsBtn />
        </div>
      </header>

      {isDemo && (
        <p className="banner" role="note" style={{ marginTop: 8 }}>
          Demo mode: sample students, saved only on this device.
        </p>
      )}

      <section className="hero">
        <div className="hero-top">
          <div>
            <div className="label">Collected this month</div>
            <div className="big">{rupees(shownCollected)}</div>
            <div className="sub">of {rupees(view.expected)} expected</div>
          </div>
          <Donut collected={view.collected} pending={view.pending} />
        </div>
        <div className="stats">
          <button type="button" className="stat-link" onClick={onPaid} disabled={!view.paidCount} aria-label={`${view.paidCount} paid. Show who.`}>
            {view.paidCount} paid
          </button>
          <button type="button" className="stat-link" onClick={onDue} disabled={!view.dueCount} aria-label={`${view.dueCount} due. Show who.`}>
            {view.dueCount} due
          </button>
          <button type="button" className="stat-link" onClick={onDue} disabled={!view.dueCount} aria-label={`${rupees(view.pending)} pending. Show who.`}>
            {rupees(view.pending)} pending
          </button>
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
        <div className="stack pad batch-grid">
          {view.batches.map((v, i) => (
            <div
              key={v.batch.id}
              role="button"
              tabIndex={0}
              className="card batch-card rise"
              style={{ '--i': i }}
              onClick={() => onOpenBatch(v.batch.id)}
              onKeyDown={(e) => e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpenBatch(v.batch.id))}
            >
              <div className="top">
                <div>
                  <div className="name">{v.batch.name}</div>
                  <div className="meta">
                    {rupees(feeFor(v.batch, month))} / month · {v.total} student{v.total === 1 ? '' : 's'}
                  </div>
                </div>
                <Icon.Right />
              </div>
              <div className="progress">
                <i style={{ width: `${v.total ? (v.paidCount / v.total) * 100 : 0}%` }} />
              </div>
              <div className="foot">
                <button
                  type="button"
                  className="stat-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenBatch(v.batch.id, 'paid');
                  }}
                  disabled={!v.paidCount}
                  aria-label={`${v.paidCount} of ${v.total} paid in ${v.batch.name}. Show who.`}
                >
                  {v.paidCount} of {v.total} paid
                </button>
                <b>{rupees(v.collected)} collected</b>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">
        <h2>Tools</h2>
      </div>
      <div className="tools">
        <button className="tool" onClick={onReport}>
          <Icon.Printer /> Monthly report
        </button>
        <button className="tool" onClick={onImport} disabled={!view.batches.length}>
          <Icon.Upload /> Import students
        </button>
        {!isDemo && (
          <button className="tool" onClick={onAdmissions}>
            <Icon.Form /> Admissions
            {newApps > 0 && (
              <span className="tool-badge" aria-label={`${newApps} new applicant${newApps === 1 ? '' : 's'}`}>
                {newApps}
              </span>
            )}
          </button>
        )}
        {!isDemo && (
          <button className="tool" onClick={onAdmissionStats}>
            <Icon.Chart /> Admission stats
          </button>
        )}
      </div>
    </>
  );
}
