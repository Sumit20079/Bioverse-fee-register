import Sheet from './Sheet';
import { rupees } from '../lib/format';

// The menu that opens when you press and hold a batch.
export default function BatchMenu({ batch, students, onOpen, onAdd, onEdit, onDelete, onClose }) {
  return (
    <Sheet title={batch.name} subtitle={`${rupees(batch.fee)} / month · ${students} student${students === 1 ? '' : 's'}`} onClose={onClose}>
      <div className="stack" style={{ gap: 8 }}>
        <button type="button" className="btn secondary" onClick={onOpen}>
          Open batch
        </button>
        <button type="button" className="btn secondary" onClick={onAdd}>
          Add a student
        </button>
        <button type="button" className="btn secondary" onClick={onEdit}>
          Edit name and fee
        </button>
        <button type="button" className="btn danger" onClick={onDelete}>
          Delete (move to bin)
        </button>
      </div>
    </Sheet>
  );
}
