import { describe, expect, it } from 'vitest';
import { parseBackup, planRestore } from '../src/lib/restore';
import { applicationsCsvRows } from '../src/lib/admissions';

const base = { batches: [{ id: 'b1' }], students: [{ id: 's1', batch_id: 'b1' }], payments: [] };
const file = (o = {}) => JSON.stringify({ app: 'bioverse-fee-register', version: 2, ...base, ...o });
const cur = (o = {}) => ({ batches: [{ id: 'b1' }], students: [{ id: 's1' }], payments: [], ...o });

describe('backup file with applications', () => {
  it('reads old backups (no applications) as "not in this file"', () => {
    expect(parseBackup(file()).applications).toBeNull();
  });
  it('adds only the applications that are missing', () => {
    const f = parseBackup(file({ applications: [{ id: 'a1' }, { id: 'a2' }] }));
    const plan = planRestore(f, cur({ applications: [{ id: 'a1' }] }));
    expect(plan.applications.map((a) => a.id)).toEqual(['a2']);
    expect(plan.total).toBe(1);
    expect(plan.appsInFile).toBe(2);
  });
  it('drops the student link when that student is not there', () => {
    const f = parseBackup(file({ applications: [{ id: 'a1', student_id: 'gone' }, { id: 'a2', student_id: 's1' }] }));
    const plan = planRestore(f, cur({ applications: [] }));
    expect(plan.applications.find((a) => a.id === 'a1').student_id).toBeNull();
    expect(plan.applications.find((a) => a.id === 'a2').student_id).toBe('s1');
  });
  it('plans nothing and says so when applications could not be loaded', () => {
    const f = parseBackup(file({ applications: [{ id: 'a1' }] }));
    const plan = planRestore(f, cur());
    expect(plan.applications).toEqual([]);
    expect(plan.appsUnchecked).toBe(true);
  });
});

describe('applications spreadsheet', () => {
  it('has a header row and one row per application', () => {
    const rows = applicationsCsvRows([
      { admission_id: 'BV26-0001', created_at: '2026-11-20T10:00:00Z', status: 'enrolled', student_name: 'Riya Das', class: '10', careers: ['NEET'], career_other: 'Vet', result_obtained: 88.4, result_total: 100, wants_counselling: true, main_contact: 'mother', deleted_at: null },
    ]);
    expect(rows).toHaveLength(2);
    const h = rows[0];
    const r = rows[1];
    expect(r[h.indexOf('Admission ID')]).toBe('BV26-0001');
    expect(r[h.indexOf('Applied on')]).toBe('2026-11-20');
    expect(r[h.indexOf('Status')]).toBe('Enrolled');
    expect(r[h.indexOf('Result')]).toBe('88.4%');
    expect(r[h.indexOf('Careers')]).toBe('NEET; Vet');
    expect(r[h.indexOf('Wants counselling')]).toBe('Yes');
    expect(r[h.indexOf('Main contact')]).toBe('Mother');
    expect(r[h.indexOf('Deleted')]).toBe('');
  });
});
