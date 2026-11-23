import { describe, expect, it } from 'vitest';
import { backupName, buildBackup, expiredNames, summaryLine } from '../api/_backup.js';
import { parseBackup, planRestore } from '../src/lib/restore.js';

describe('nightly backup', () => {
  const data = { batches: [{ id: 'b1' }], students: [{ id: 's1', batch_id: 'b1' }], payments: [], applications: [{ id: 'a1' }] };
  it('makes a file the Restore screen can read', () => {
    const file = parseBackup(JSON.stringify(buildBackup(data)));
    const plan = planRestore(file, { batches: [], students: [], payments: [], applications: [] });
    expect(plan.batches).toHaveLength(1);
    expect(plan.students).toHaveLength(1);
    expect(plan.applications).toHaveLength(1);
  });
  it('names files by date and describes them', () => {
    expect(backupName('2026-11-24')).toBe('fee-register-backup-2026-11-24.json');
    expect(summaryLine(buildBackup(data))).toBe('1 students, 0 payments, 1 applications');
  });
  it('expires only our own files older than 30 days', () => {
    const names = ['fee-register-backup-2026-10-01.json', 'fee-register-backup-2026-10-24.json', 'fee-register-backup-2026-10-25.json', 'fee-register-backup-2026-11-23.json', 'notes.txt'];
    expect(expiredNames(names, '2026-11-24')).toEqual(['fee-register-backup-2026-10-01.json', 'fee-register-backup-2026-10-24.json']);
  });
});
