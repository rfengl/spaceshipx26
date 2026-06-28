import { describe, it, expect } from 'vitest';

import { fillDailyWindow } from '../../../src/pages/Resources/usageWindow';

const dayOffset = (daysAgo: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

describe('fillDailyWindow', () => {
  it('returns one entry per day in the window, oldest first', () => {
    const filled = fillDailyWindow([], 7);
    expect(filled).toHaveLength(7);
    expect(filled[0].day).toBe(dayOffset(6));
    expect(filled[6].day).toBe(dayOffset(0));
  });

  it('fills missing days with zero', () => {
    const filled = fillDailyWindow([], 3);
    expect(filled.every((d) => d.count === 0)).toBe(true);
  });

  it('keeps counts for days that have usage', () => {
    const sparse = [
      { day: dayOffset(2), count: 5 },
      { day: dayOffset(0), count: 3 },
    ];
    const filled = fillDailyWindow(sparse, 3);
    expect(filled.map((d) => d.count)).toEqual([5, 0, 3]);
  });

  it('ignores usage that falls outside the window', () => {
    const sparse = [{ day: dayOffset(10), count: 9 }];
    const filled = fillDailyWindow(sparse, 3);
    expect(filled.reduce((s, d) => s + d.count, 0)).toBe(0);
  });
});
