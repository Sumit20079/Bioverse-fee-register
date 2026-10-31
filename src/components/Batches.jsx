import { Icon } from './Icons';
import { rupees } from '../lib/format';

// Manage list: open a batch, edit its fee, create a new one.
export default function Batches({ view, onOpenBatch, onEditBatch, onNewBatch }) {
  return (
    <>
      <header className="head">
        <div>
          <div className="kicker">Manage</div>
          <h1>Batches</h1>
        </div>
        <button className="sbtn primary" onClick={onNewBatch}>
          <Icon.Plus /> New batch
        </button>
      </header>

      {view.batches.length === 0 ? (
        <div className="card empty" style={{ marginInline: 20, marginTop: 12 }}>
          <p>No batches yet. Each batch has its own monthly fee, so create one per class or timing.</p>
        </div>
      ) : (
        <div className="list" style={{ marginTop: 12 }}>
          {view.batches.map((v, i) => (
            <div className="row rise" style={{ '--i': i }} key={v.batch.id}>
              <button className="who" style={{ flex: 1 }} onClick={() => onOpenBatch(v.batch.id)}>
                <div className="n">{v.batch.name}</div>
                <div className="d">
                  {rupees(v.batch.fee)} / month · {v.total} student{v.total === 1 ? '' : 's'}
                </div>
              </button>
              <button className="iconbtn" aria-label={`Edit ${v.batch.name}`} onClick={() => onEditBatch(v.batch)}>
                <Icon.Pencil />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
