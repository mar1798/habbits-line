import { BACKUP_STALE_AFTER_DAYS, backupStatus } from '../backup-status';
import { shiftDateKey } from '../date';

const TODAY = '2026-09-07';

describe('backupStatus', () => {
  it('says nothing on an empty app that has never exported', () => {
    expect(backupStatus(null, TODAY, false)).toEqual({ kind: 'idle' });
  });

  it('warns once there is data and no export', () => {
    expect(backupStatus(null, TODAY, true)).toEqual({ kind: 'never' });
  });

  it('counts the days since the export', () => {
    expect(backupStatus('2026-09-01', TODAY, true)).toEqual({
      kind: 'fresh',
      date: '2026-09-01',
      days: 6,
    });
  });

  it('today’s export is zero days old', () => {
    expect(backupStatus(TODAY, TODAY, true)).toEqual({ kind: 'fresh', date: TODAY, days: 0 });
  });

  // The boundary the hint's colour turns on: the threshold day itself is still fresh.
  it('turns stale the day after the threshold', () => {
    const onThreshold = shiftDateKey(TODAY, -BACKUP_STALE_AFTER_DAYS);
    const past = shiftDateKey(TODAY, -BACKUP_STALE_AFTER_DAYS - 1);
    expect(backupStatus(onThreshold, TODAY, true).kind).toBe('fresh');
    expect(backupStatus(past, TODAY, true).kind).toBe('stale');
  });

  // Everything below comes from `app_settings`, which import and hand-editing can fill
  // with anything at all.
  it('reads an unparseable row as never exported', () => {
    expect(backupStatus('yesterday', TODAY, true)).toEqual({ kind: 'never' });
    expect(backupStatus('2026-02-31', TODAY, true)).toEqual({ kind: 'never' });
    expect(backupStatus('', TODAY, false)).toEqual({ kind: 'idle' });
  });

  it('clamps an export dated in the future to zero days', () => {
    expect(backupStatus('2026-09-20', TODAY, true)).toEqual({
      kind: 'fresh',
      date: '2026-09-20',
      days: 0,
    });
  });
});
