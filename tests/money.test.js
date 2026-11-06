import { describe, expect, it } from 'vitest';
import { batchAt, dueList, feeFor, feeOn, monthStatus, monthView, staleSettled, withBatchMove, withFeeChange } from '../src/lib/calc';
import { summarise } from '../src/lib/collections';

const row = (id, amount, settled, month = '2026-11') => ({ id, student_id: 's1', month, amount, settled, paid_on: `${month}-0${id}` });

// What the app does after an edit or removal: un-settle the rows that went stale.
const afterChange = (before, after, fee) => {
  const stale = new Set(staleSettled(before, after, fee).map((r) => r.id));
  return after.map((r) => (stale.has(r.id) ? { ...r, settled: false } : r));
};

describe('part payments', () => {
  const fee = 1500;
  it('₹1,000 of ₹1,500 leaves ₹500 due', () => {
    const s = monthStatus([row(1, 1000, false)], fee);
    expect(s.status).toBe('part');
    expect(s.balance).toBe(500);
  });
  it('a second ₹500 completes the month', () => {
    expect(monthStatus([row(1, 1000, false), row(2, 500, true)], fee).status).toBe('paid');
  });
  it('editing the first instalment down re-opens the month', () => {
    const before = [row(1, 1000, false), row(2, 500, true)];
    const after = afterChange(before, [row(1, 500, false), row(2, 500, true)], fee);
    const s = monthStatus(after, fee);
    expect(s.status).toBe('part');
    expect(s.balance).toBe(500);
  });
  it('deleting the first instalment re-opens the month', () => {
    const before = [row(1, 1000, false), row(2, 500, true)];
    const after = afterChange(before, [row(2, 500, true)], fee);
    expect(monthStatus(after, fee).balance).toBe(1000);
  });
  it('editing the last instalment down is handled by the row itself', () => {
    expect(monthStatus([row(1, 1000, false), row(2, 200, false)], fee).balance).toBe(300);
  });
  it('a waived rest stays settled when another instalment is edited', () => {
    const before = [row(1, 1000, false), row(2, 200, true)]; // ₹300 waived
    const after = afterChange(before, [row(1, 900, false), row(2, 200, true)], fee);
    expect(monthStatus(after, fee).status).toBe('paid');
  });
  it('a zero-fee month is never due', () => {
    expect(monthStatus([], 0).settled).toBe(true);
  });
  it('payments saved before part payments existed (no flag) count as paid', () => {
    expect(monthStatus([{ id: 1, amount: 1500 }], fee).status).toBe('paid');
  });
});

describe('batch fee changes', () => {
  const batch = { id: 'A', fee: 1500 };
  it('a new fee applies from its month only', () => {
    const b = { ...batch, ...withFeeChange(batch, 2000, '2026-10') };
    expect(feeFor(b, '2026-09')).toBe(1500);
    expect(feeFor(b, '2026-10')).toBe(2000);
    expect(feeFor(b, '2026-12')).toBe(2000);
  });
  it('a later change keeps the earlier ones', () => {
    let b = { ...batch, ...withFeeChange(batch, 2000, '2026-10') };
    b = { ...b, ...withFeeChange(b, 2500, '2027-01') };
    expect([feeFor(b, '2026-09'), feeFor(b, '2026-11'), feeFor(b, '2027-02')]).toEqual([1500, 2000, 2500]);
  });
});

describe('moving students', () => {
  const A = { id: 'A', name: 'A', fee: 1500 };
  const B = { id: 'B', name: 'B', fee: 2000 };
  const base = { id: 's1', name: 'Stu', batch_id: 'A', joined_month: '2026-08', active: true };
  const moved = { ...base, ...withBatchMove(base, 'B', '2026-10', '2026-11') };

  it('a student who never moved is always in their batch', () => {
    expect(batchAt(base, '2026-09')).toBe('A');
  });
  it('earlier months stay in the old batch, later ones are in the new', () => {
    expect(moved.batch_id).toBe('B');
    expect([batchAt(moved, '2026-09'), batchAt(moved, '2026-10'), batchAt(moved, '2026-11')]).toEqual(['A', 'B', 'B']);
  });
  it('previous months keep the old fee', () => {
    expect(feeOn(moved, [A, B], '2026-09')).toBe(1500);
    expect(feeOn(moved, [A, B], '2026-10')).toBe(2000);
  });
  it('moving back, and re-moving from an earlier month', () => {
    const back = { ...moved, ...withBatchMove(moved, 'A', '2026-11', '2026-11') };
    expect([batchAt(back, '2026-10'), batchAt(back, '2026-11'), back.batch_id]).toEqual(['B', 'A', 'A']);
    const again = { ...back, ...withBatchMove(back, 'B', '2026-10', '2026-11') };
    expect([batchAt(again, '2026-09'), batchAt(again, '2026-11')]).toEqual(['A', 'B']);
  });
  it('the Overview shows the student in the batch they were in that month', () => {
    const pays = [row(1, 1500, true, '2026-09'), row(2, 2000, true, '2026-10')];
    const data = { batches: [A, B], students: [moved], payments: pays };
    const sep = monthView(data, '2026-09');
    expect([sep.batches[0].total, sep.batches[0].collected, sep.batches[1].total]).toEqual([1, 1500, 0]);
    const oct = monthView(data, '2026-10');
    expect([oct.batches[0].total, oct.batches[1].total, oct.batches[1].collected]).toEqual([0, 1, 2000]);
  });
  it('dues use the fee of the batch they were in for each month', () => {
    const data = { batches: [A, B], students: [moved], payments: [row(1, 1500, true, '2026-09')] };
    expect(dueList(data, '2026-10')[0].amount).toBe(1500 + 2000); // Aug at A, Oct at B
  });
  it('the Collected report counts a payment under the batch of its month', () => {
    const data = { batches: [A, B], students: [moved], payments: [row(1, 1500, true, '2026-09')] };
    const period = { kind: 'month', start: '2026-09-01', end: '2026-09-30', label: 'Sep' };
    expect(summarise(data, period, 'all').batches.map((x) => x.batch.id)).toEqual(['A']);
    expect(summarise(data, period, 'B').rows).toHaveLength(0);
    expect(summarise(data, period, 'A').rows).toHaveLength(1);
  });
  it('a deleted old batch still prices the months spent there', () => {
    const gone = { ...A, deleted_at: 'x' };
    const data = { batches: [B], allBatches: [gone, B], students: [moved], payments: [] };
    expect(feeOn(moved, data.allBatches, '2026-09')).toBe(1500);
    expect(dueList(data, '2026-10')[0].amount).toBe(1500 * 2 + 2000);
  });
});
