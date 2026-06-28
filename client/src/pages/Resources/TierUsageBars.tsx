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
  const max = Math.max(1, ...data.map((t) => t.uses));

  if (total === 0) {
    return <p className="muted m-0 text-[0.85rem]">No usage recorded yet.</p>;
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {data.map((t) => {
        const pct = Math.round((t.uses / total) * 100);
        return (
          <li key={t.level} className="flex items-center gap-3 text-[0.85rem]">
            <span className={`tier tier-${t.level} w-20 shrink-0 text-center`}>
              {t.level}
            </span>
            <span
              className="h-3 rounded bg-[#5ad0ff]"
              style={{ width: `${(t.uses / max) * 100}%`, minWidth: t.uses ? 4 : 0 }}
            />
            <span className="muted shrink-0">
              {t.uses} ({pct}%)
            </span>
          </li>
        );
      })}
    </ul>
  );
}
