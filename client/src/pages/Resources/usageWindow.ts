import type { DailyUsage } from '../../api/resources';

/**
 * Expand a sparse daily-usage series into a continuous `days`-long window ending
 * today (UTC), filling missing days with 0 so the trend line has no gaps. Oldest
 * day first.
 */
export function fillDailyWindow(daily: DailyUsage[], days: number): DailyUsage[] {
  const counts = new Map(daily.map((d) => [d.day, d.count]));
  const today = new Date();
  const out: DailyUsage[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    out.push({ day, count: counts.get(day) ?? 0 });
  }
  return out;
}
