import { useMemo, useState } from 'react';
import { Icon } from './Icons';
import { rupees } from '../lib/format';
import { useWide } from '../lib/useWide';

const digitsOf = (v) => String(v || '').replace(/\D/g, '');

// Find a student by name, either phone number, or batch name, across every batch.
export default function Search({ students, batches, dues, onOpen }) {
  const [q, setQ] = useState('');
  const wide = useWide();
  const batchName = useMemo(() => new Map(batches.map((b) => [b.id, b.name])), [batches]);
  const dueBy = useMemo(() => new Map(dues.map((d) => [d.student.id, d])), [dues]);

  const { hits, more } = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return { hits: [], more: 0 };
    const all = students.filter((s) => {
      const hay = `${s.name} ${batchName.get(s.batch_id) || ''}`.toLowerCase();
      const nums = `${digitsOf(s.phone)} ${digitsOf(s.parent_phone)}`;
      return words.every((w) => hay.includes(w) || (digitsOf(w).length >= 3 && nums.includes(digitsOf(w))));
    });
    all.sort((a, b) => a.name.localeCompare(b.name));
    return { hits: all.slice(0, 40), more: Math.max(0, all.length - 40) };
  }, [q, students, batchName]);

  return (
    <>
      <header className="head">
        <div>
          <div className="kicker">{students.length} students</div>
          <h1>Search</h1>
        </div>
      </header>

      <div className="searchbar">
        <Icon.Search width={20} height={20} />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, phone number or batch"
          aria-label="Search students"
          autoFocus={wide}
        />
      </div>

      {!q.trim() ? (
        <p className="muted" style={{ padding: '4px 20px' }}>Type part of a name, a phone number, or a batch name.</p>
      ) : hits.length === 0 ? (
        <div className="card empty" style={{ marginInline: 20 }}>
          <p>No student matches “{q.trim()}”.</p>
        </div>
      ) : (
        <div className="list">
          {hits.map((s) => {
            const due = dueBy.get(s.id);
            return (
              <div className="row" key={s.id}>
                <button className="who" onClick={() => onOpen(s)} aria-label={`Open ${s.name}`}>
                  <div className="n">
                    {s.name}
                    {!s.active && <span className="tag">Left</span>}
                  </div>
                  <div className="d">
                    {batchName.get(s.batch_id)}
                    {s.phone ? ` · ${s.phone}` : ''}
                  </div>
                </button>
                {s.active &&
                  (due ? (
                    <span className="pill due">Due {rupees(due.amount)}</span>
                  ) : (
                    <span className="pill paid">Paid up</span>
                  ))}
              </div>
            );
          })}
          {more > 0 && <p className="muted small" style={{ padding: '10px 16px' }}>{more} more. Type more of the name to narrow it down.</p>}
        </div>
      )}
    </>
  );
}
