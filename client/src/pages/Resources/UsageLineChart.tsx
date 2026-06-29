import type { DailyUsage } from '../../api/resources';

interface Props {
  /** A continuous daily series (oldest first) — see fillDailyWindow. */
  points: DailyUsage[];
  /** The resource's capacity, drawn as a red reference line. */
  maxQty: number;
}

const W = 640;
const H = 220;
const M = { top: 16, right: 16, bottom: 28, left: 40 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

const mmdd = (day: string) => day.slice(5); // YYYY-MM-DD -> MM-DD

/**
 * Inline-SVG line chart of daily usage (no charting dependency). Has labelled X
 * (dates) and Y (count) axes and a red reference line at the resource's max
 * capacity, so consumption is read against the total it can hold.
 */
export default function UsageLineChart({ points, maxQty }: Props) {
  const peak = Math.max(...points.map((p) => p.count), 0);
  const yMax = Math.max(maxQty, peak, 1);
  const total = points.reduce((s, p) => s + p.count, 0);

  const x = (i: number) =>
    M.left + (points.length > 1 ? (i / (points.length - 1)) * PLOT_W : 0);
  const y = (v: number) => M.top + PLOT_H - (v / yMax) * PLOT_H;

  const line = points.map((p, i) => `${x(i)},${y(p.count)}`).join(' ');
  const yTicks = [0, Math.round(yMax / 2), yMax];
  const xTickIdx = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  // Width of each day's hover band (so the tooltip is easy to hit).
  const bandW = points.length > 1 ? PLOT_W / (points.length - 1) : PLOT_W;

  return (
    <figure className="m-0">
      <figcaption className="muted mb-2 text-[0.8rem]">
        {total} use{total === 1 ? '' : 's'} over the last {points.length} days
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Daily usage over the last ${points.length} days (capacity ${maxQty})`}
      >
        {/* Y axis with ticks */}
        <line
          x1={M.left}
          y1={M.top}
          x2={M.left}
          y2={M.top + PLOT_H}
          stroke="rgba(255,255,255,0.2)"
        />
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              y1={y(t)}
              x2={M.left + PLOT_W}
              y2={y(t)}
              stroke="rgba(255,255,255,0.06)"
            />
            <text
              x={M.left - 6}
              y={y(t) + 3}
              textAnchor="end"
              fontSize="10"
              fill="#7f93b8"
            >
              {t}
            </text>
          </g>
        ))}

        {/* X axis with date ticks */}
        <line
          x1={M.left}
          y1={M.top + PLOT_H}
          x2={M.left + PLOT_W}
          y2={M.top + PLOT_H}
          stroke="rgba(255,255,255,0.2)"
        />
        {xTickIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={M.top + PLOT_H + 16}
            textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
            fontSize="10"
            fill="#7f93b8"
          >
            {points[i] && mmdd(points[i].day)}
          </text>
        ))}

        {/* Red capacity reference line */}
        <line
          x1={M.left}
          y1={y(maxQty)}
          x2={M.left + PLOT_W}
          y2={y(maxQty)}
          stroke="#ff6b6b"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text
          x={M.left + PLOT_W}
          y={y(maxQty) - 4}
          textAnchor="end"
          fontSize="10"
          fill="#ff9d9d"
        >
          max {maxQty}
        </text>

        {/* Usage line + points */}
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
            r={p.count > 0 ? 3 : 1.5}
            fill="#5ad0ff"
          />
        ))}

        {/* Invisible full-height hover bands so the tooltip is easy to hit —
            mouse anywhere in a day's column, not just on the small dot. */}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.day}`}
            x={x(i) - bandW / 2}
            y={M.top}
            width={bandW}
            height={PLOT_H}
            fill="transparent"
          >
            <title>
              {p.day}: {p.count} use{p.count === 1 ? '' : 's'}
            </title>
          </rect>
        ))}
      </svg>
    </figure>
  );
}
