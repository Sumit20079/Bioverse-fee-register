import SettingsBtn from './SettingsBtn';
import { Icon } from './Icons';
import { filterApplications, monthlyRows, STAT_FILTERS, totals } from '../lib/admissions';

export default function AdmissionStats({ apps, error, filters, onFilter, onClear, onRetry, onBack }) {
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

          <div className="st-sum" aria-label="Totals for the current filters">
            <div>
              <b>{t.applied}</b>
              <span>Applied</span>
            </div>
            <div className="e">
              <b>{t.enrolled}</b>
              <span>Enrolled</span>
            </div>
            <div className="d">
              <b>{t.dropped}</b>
              <span>Dropped</span>
            </div>
          </div>
          <p className="st-rate muted">{t.applied ? `${t.rate}% of these applicants enrolled` : 'No applicants match these filters'}</p>

          <div className="card st-table" role="table" aria-label="Applications by month">
            <div className="st-tr st-th" role="row">
              <span role="columnheader">Month</span>
              <span role="columnheader">Applied</span>
              <span role="columnheader">Enrolled</span>
              <span role="columnheader">Dropped</span>
            </div>
            {rows.map((r) => (
              <div className="st-tr" role="row" key={r.k}>
                <span role="cell" className="m">
                  {r.label}
                </span>
                <span role="cell" className={r.applied ? '' : 'z'}>
                  {r.applied}
                </span>
                <span role="cell" className={r.enrolled ? 'e' : 'z'}>
                  {r.enrolled}
                </span>
                <span role="cell" className={r.dropped ? 'd' : 'z'}>
                  {r.dropped}
                </span>
              </div>
            ))}
          </div>
          <p className="muted small st-note">Counted by the month the application came in.</p>
        </>
      )}
    </>
  );
}
