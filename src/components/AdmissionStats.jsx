import SettingsBtn from './SettingsBtn';
import { Icon } from './Icons';
import { filterApplications, monthlyRows, STAT_FILTERS, totals } from '../lib/admissions';

export default function AdmissionStats({ apps, error, filters, onFilter, onClear, onDrill, onRetry, onBack }) {
  const shown = apps ? filterApplications(apps, filters) : [];
  const t = totals(shown);
  const rows = apps ? monthlyRows(shown, apps) : [];
  const active = Object.values(filters).some((v) => v.length);

  return (
    <>
      <header className="head">
        <div className="back">
          <button className="iconbtn" aria-label="Back" onClick={onBack}>
            <Icon.Left />
          </button>
          <div>
            <div className="kicker">Admissions</div>
            <h1>Admission stats</h1>
          </div>
        </div>
        <SettingsBtn />
      </header>

      {error && (
        <div className="card empty" style={{ marginInline: 20, marginTop: 12 }}>
          <p>{error}</p>
          <button className="sbtn primary" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
      {!apps && !error && <p className="muted" style={{ padding: '16px 20px' }}>Loading…</p>}

      {apps && apps.length === 0 && (
        <div className="card empty" style={{ marginInline: 20, marginTop: 12 }}>
          <p>No applications yet. Stats appear here once students start applying.</p>
        </div>
      )}

      {apps && apps.length > 0 && (
        <>
          <div className="chips st-filters" role="group" aria-label="Filters">
            {Object.entries(STAT_FILTERS).map(([k, f]) => {
              const n = filters[k].length;
              return (
                <button key={k} className={'chip' + (n ? ' on' : '')} aria-haspopup="dialog" onClick={() => onFilter(k)}>
                  {f.label}
                  {n > 0 && <span className="st-n">{n}</span>}
                  <span aria-hidden="true"> ▾</span>
                </button>
              );
            })}
            {active && (
              <button className="chip st-clear" onClick={onClear}>
                Clear
              </button>
            )}
          </div>

          <div className="st-sum" role="group" aria-label="Totals for the current filters. Tap a number to see who.">
            <button className="st-box" disabled={!t.applied} onClick={() => onDrill({ label: 'Applied' })}>
              <b>{t.applied}</b>
              <span>Applied</span>
            </button>
            <button className="st-box e" disabled={!t.enrolled} onClick={() => onDrill({ label: 'Enrolled', status: 'enrolled' })}>
              <b>{t.enrolled}</b>
              <span>Enrolled</span>
            </button>
            <button className="st-box d" disabled={!t.dropped} onClick={() => onDrill({ label: 'Dropped', status: 'dropped' })}>
              <b>{t.dropped}</b>
              <span>Dropped</span>
            </button>
          </div>
          <p className="st-rate muted">{t.applied ? `${t.rate}% of these applicants enrolled. Tap a number to see who.` : 'No applicants match these filters'}</p>

          <div className="card st-table" role="table" aria-label="Applications by month">
            <div className="st-tr st-th" role="row">
              <span role="columnheader">Month</span>
              <span role="columnheader">Applied</span>
              <span role="columnheader">Enrolled</span>
              <span role="columnheader">Dropped</span>
            </div>
            {rows.map((r) => {
              const cell = (n, cls, status) => (
                <span role="cell" className={(n ? cls : 'z') + (n ? ' go' : '')}>
                  {n ? (
                    <button type="button" className="st-cell" aria-label={`${n} ${status || 'applied'} in ${r.label}. Show who.`} onClick={() => onDrill({ label: status ? status[0].toUpperCase() + status.slice(1) : 'Applied', status, k: r.k, month: r.label })}>
                      {n}
                    </button>
                  ) : (
                    n
                  )}
                </span>
              );
              return (
                <div className="st-tr" role="row" key={r.k}>
                  <span role="cell" className="m">
                    {r.label}
                  </span>
                  {cell(r.applied, '', undefined)}
                  {cell(r.enrolled, 'e', 'enrolled')}
                  {cell(r.dropped, 'd', 'dropped')}
                </div>
              );
            })}
          </div>
          <p className="muted small st-note">Counted by the month the application came in. Tap any number to see those students.</p>
        </>
      )}
    </>
  );
}
