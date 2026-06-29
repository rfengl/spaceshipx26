import type { TierUsage } from '../../api/resources';

interface Props {
  data: TierUsage[];
}

/**
 * Which membership tiers consume a resource, as simple horizontal bars. Chosen
 * over a pie chart: the part-to-whole comparison reads more clearly and needs no
 * arc maths or charting dependency.
 */
export default function TierUsageBars({ data }: Props) {
  const total = data.reduce((s, t) => s + t.uses, 0);

  if (total === 0) {
    return <p className="muted m-0 text-[0.85rem]">No usage recorded yet.</p>;
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {data.map((t) => {
        // Bar length is the tier's share of total usage, so it matches the %.
        const share = (t.uses / total) * 100;
        return (
          <li key={t.level} className="flex items-center gap-3 text-[0.85rem]">
            <span className={`tier tier-${t.level} w-20 shrink-0 text-center`}>
              {t.level}
            </span>
            {/* Fixed-width track so the fill length reads as a true percentage. */}
            <span className="h-3 flex-1 overflow-hidden rounded bg-white/[0.06]">
              <span
                className="block h-full rounded bg-[#5ad0ff]"
                style={{ width: `${share}%` }}
              />
            </span>
            <span className="muted w-24 shrink-0 text-right">
              {t.uses} ({Math.round(share)}%)
            </span>
          </li>
        );
      })}
    </ul>
  );
}
