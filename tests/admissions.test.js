import { describe, expect, it } from 'vitest';
import { ago, mainParent, possibleDuplicates, resultText, studentFromApplication } from '../src/lib/admissions';

const app = (o = {}) => ({
  id: 'a1', student_name: ' Riya Das ', student_phone: '9000000001', school: 'Sample School A', status: 'new',
  father_name: 'Raj', father_phone: '9000000011', mother_name: 'Sunita', mother_phone: '9000000012', main_contact: 'mother',
  result_obtained: 410, result_total: 500, result_percent: 82, ...o,
});

describe('enrolling', () => {
  it('makes a student with the main contact parent as the parent number', () => {
    expect(studentFromApplication(app(), 'b1', '2026-11')).toEqual({
      id: 'a1', name: 'Riya Das', phone: '9000000001', parent_phone: '9000000012', batch_id: 'b1', joined_month: '2026-11', active: true,
    });
    expect(studentFromApplication(app({ main_contact: 'father' }), 'b1', '2026-11').parent_phone).toBe('9000000011');
  });
  it('picks the right parent', () => {
    expect(mainParent(app()).role).toBe('Mother');
    expect(mainParent(app({ main_contact: 'father' })).phone).toBe('9000000011');
  });
});

describe('showing an application', () => {
  it('writes the result the way it was entered', () => {
    expect(resultText(app({ result_obtained: 88.4, result_total: 100 }))).toBe('88.4%');
    expect(resultText(app({ result_obtained: 540, result_total: 720 }))).toBe('NEET 540 / 720');
    expect(resultText(app())).toBe('410 / 500 (82%)');
  });
  it('says how long ago', () => {
    expect(ago(new Date(Date.now() - 2 * 3600 * 1000).toISOString())).toBe('2 hours ago');
    expect(ago(new Date(Date.now() - 26 * 3600 * 1000).toISOString())).toBe('Yesterday');
  });
});

describe('possible duplicates', () => {
  it('flags the same phone, the same name and school, and numbers already in the register', () => {
    const list = [app({ id: 'x1' }), app({ id: 'x2', student_name: 'Other', student_phone: '9000000001' }), app({ id: 'x3', student_phone: '9111111111', student_name: 'riya  das' }), app({ id: 'x4', student_phone: '9222222222', student_name: 'Unique', school: 'Elsewhere' })];
    const dup = possibleDuplicates(list, []);
    expect([...dup].sort()).toEqual(['x1', 'x2', 'x3']);
    expect(possibleDuplicates([list[3]], [{ phone: '+91 92222 22222' }]).has('x4')).toBe(true);
  });
  it('does not flag an already enrolled applicant against the register', () => {
    expect(possibleDuplicates([app({ status: 'enrolled' })], [{ phone: '9000000001' }]).size).toBe(0);
  });
});

import { bandOf, filterApplications, monthlyRows, NO_FILTERS, totals } from '../src/lib/admissions';
describe('admission stats', () => {
  const mk = (o) => ({ status: 'new', class: '10', batch_location: 'Habra', referred_from: 'Friend', result_total: 100, result_percent: 75, created_at: '2026-11-10T10:00:00Z', ...o });
  const apps = [
    mk({ status: 'enrolled', result_percent: 85 }),
    mk({ status: 'enrolled', class: '12', batch_location: 'Jaguli', referred_from: 'Teacher', result_percent: 92 }),
    mk({ status: 'dropped', created_at: '2026-10-05T10:00:00Z', result_percent: 45 }),
    mk({ status: 'counselled', class: 'Dropper', result_total: 720, result_percent: 9.6, created_at: '2026-09-01T10:00:00Z' }),
    mk({}),
  ];
  const now = new Date('2026-11-21T10:00:00');
  it('totals applied, enrolled, dropped and the rate', () => {
    expect(totals(apps)).toEqual({ applied: 5, enrolled: 2, dropped: 1, rate: 40 });
    expect(totals([])).toEqual({ applied: 0, enrolled: 0, dropped: 0, rate: 0 });
  });
  it('lists every month from the first application to now, newest first', () => {
    const rows = monthlyRows(apps, apps, now);
    expect(rows.map((r) => r.label)).toEqual(['Nov 2026', 'Oct 2026', 'Sept 2026']);
    expect(rows[0]).toMatchObject({ applied: 3, enrolled: 2, dropped: 0 });
    expect(rows[1]).toMatchObject({ applied: 1, enrolled: 0, dropped: 1 });
    expect(rows[2]).toMatchObject({ applied: 1, enrolled: 0, dropped: 0 });
  });
  it('keeps the month range when filters hide everything in a month', () => {
    const only12 = filterApplications(apps, { ...NO_FILTERS, class: ['12'] });
    const rows = monthlyRows(only12, apps, now);
    expect(rows).toHaveLength(3);
    expect(rows[0].applied).toBe(1);
    expect(rows[1].applied).toBe(0);
  });
  it('filters: several picks in one group are OR, different groups are AND', () => {
    expect(filterApplications(apps, { ...NO_FILTERS, class: ['10', '12'] })).toHaveLength(4);
    expect(filterApplications(apps, { ...NO_FILTERS, class: ['10', '12'], location: ['Jaguli'] })).toHaveLength(1);
    expect(filterApplications(apps, { ...NO_FILTERS, referred: ['Teacher'] })).toHaveLength(1);
    expect(filterApplications(apps, NO_FILTERS)).toHaveLength(5);
  });
  it('result bands, with NEET marks as their own group', () => {
    expect(bandOf(mk({ result_percent: 45 }))).toBe('Below 50%');
    expect(bandOf(mk({ result_percent: 80 }))).toBe('80–89%');
    expect(bandOf(mk({ result_percent: 90 }))).toBe('90%+');
    expect(bandOf(mk({ result_total: 720, result_percent: 75 }))).toBe('NEET marks (out of 720)');
    expect(filterApplications(apps, { ...NO_FILTERS, result: ['NEET marks (out of 720)'] })).toHaveLength(1);
    expect(filterApplications(apps, { ...NO_FILTERS, result: ['80–89%', '90%+'] })).toHaveLength(2);
  });
});
