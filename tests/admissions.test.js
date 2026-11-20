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
