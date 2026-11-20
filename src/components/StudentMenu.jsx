import Sheet from './Sheet';

// The menu that opens when you press and hold a student's name in a batch.
export default function StudentMenu({ student, batchName, onEdit, onMove, onHistory, onSelect, onDelete, onClose }) {
  return (
    <Sheet title={student.name} subtitle={batchName} onClose={onClose}>
      <div className="stack" style={{ gap: 8 }}>
        <button type="button" className="btn secondary" onClick={onEdit}>
          Edit student
        </button>
        <button type="button" className="btn secondary" onClick={onMove}>
          Move to another batch
        </button>
        <button type="button" className="btn secondary" onClick={onHistory}>
          Payment history
        </button>
        <button type="button" className="btn secondary" onClick={onSelect}>
          Select
        </button>
        <button type="button" className="btn danger" onClick={onDelete}>
          Delete (move to bin)
        </button>
      </div>
    </Sheet>
  );
}
