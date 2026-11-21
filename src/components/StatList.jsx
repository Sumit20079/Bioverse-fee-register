import Sheet from './Sheet';
import { ago, resultText, STATUS_LABEL } from '../lib/admissions';

// The applicants behind a number on the stats screen. Tap one to open their details.
export default function StatList({ title, subtitle, apps, onOpen, onClose }) {
  return (
    <Sheet title={title} subtitle={subtitle} onClose={onClose}>
      {apps.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>
          No applicants here any more.
        </p>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {apps.map((a) => (
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
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
