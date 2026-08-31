import { extendRange } from '../date-range';

describe('extendRange', () => {
  it('opens a range on the first tap', () => {
    expect(extendRange(null, '2026-08-10')).toEqual({ start: '2026-08-10', end: null });
  });

  it('closes an open range on a later day', () => {
    expect(extendRange({ start: '2026-08-10', end: null }, '2026-08-20')).toEqual({
      start: '2026-08-10',
      end: '2026-08-20',
    });
  });

  it('accepts the same day twice as a one-day range', () => {
    expect(extendRange({ start: '2026-08-10', end: null }, '2026-08-10')).toEqual({
      start: '2026-08-10',
      end: '2026-08-10',
    });
  });

  it('reopens from an earlier day rather than flipping the ends', () => {
    expect(extendRange({ start: '2026-08-10', end: null }, '2026-08-01')).toEqual({
      start: '2026-08-01',
      end: null,
    });
  });

  it('starts over once a range is finished', () => {
    expect(extendRange({ start: '2026-08-10', end: '2026-08-20' }, '2026-08-25')).toEqual({
      start: '2026-08-25',
      end: null,
    });
  });

  it('starts over on a day inside the finished range', () => {
    expect(extendRange({ start: '2026-08-10', end: '2026-08-20' }, '2026-08-15')).toEqual({
      start: '2026-08-15',
      end: null,
    });
  });
});
