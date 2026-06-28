import type { DailyUsage } from '../../api/resources';

interface Props {
  /** A continuous daily series (oldest first) — see fillDailyWindow. */
  points: DailyUsage[];
}

const W = 600;
const H = 160;
const PAD = 24;

/**
 * A minimal inline-SVG line chart of daily usage — no charting dependency. The
 * polyline scales to the busiest day; hovering a point shows its date and count.
 */
export default function UsageLineChart({ points }: Props) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  const x = (i: number) => PAD + i * stepX;
  const y = (count: number) => H - PAD - (count / max) * (H - PAD * 2);

  const line = points.map((p, i) => `${x(i)},${y(p.count)}`).join(' ');
  const total = points.reduce((s, p) => s + p.count, 0);

  return (
    <figure className="m-0">
      <figcaption className="muted mb-2 text-[0.8rem]">
        {total} use{total === 1 ? '' : 's'} over the last {points.length} days
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Daily usage for the last ${points.length} days`}
      >
        {/* baseline */}
        <line
          x1={PAD}
          y1={H - PAD}
          x2={W - PAD}
          y2={H - PAD}
          stroke="rgba(255,255,255,0.15)"
        />
        {points.length > 1 && (
          <polyline
            points={line}
            fill="none"
            stroke="#5ad0ff"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((p, i) => (
          <circle
            key={p.day}
            cx={x(i)}
            cy={y(p.count)}
            r={p.count > 0 ? 3 : 2}
            fill="#5ad0ff"
          >
            <title>
              {p.day}: {p.count}
            </title>
          </circle>
        ))}
      </svg>
    </figure>
  );
}
