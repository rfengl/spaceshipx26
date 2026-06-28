import ResourceActions, { type ResourceActionHandlers } from './ResourceActions';
import type { Resource } from '../../types';

// Colour cards by remaining stock so the worst shortages stand out.
function stockCard(remaining: number, max: number) {
  const ratio = max > 0 ? remaining / max : 0;
  if (ratio < 1 / 3) return 'border-[rgba(255,99,99,0.5)] bg-[rgba(255,80,80,0.12)]';
  if (ratio < 0.5) return 'border-[rgba(255,200,80,0.5)] bg-[rgba(255,200,80,0.11)]';
  return 'border-white/[0.08] bg-white/[0.04]';
}

interface Props extends ResourceActionHandlers {
  items: Resource[];
  isCrew: boolean;
  focusId: string | null;
  setFocusRef: (el: HTMLElement | null) => void;
}

/** Mobile (xs/sm) view: resources as a card grid. Crew see the action row. */
export default function ResourceCards({
  items,
  isCrew,
  focusId,
  setFocusRef,
  ...actions
}: Props) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((r) => {
        const focused = r.id === focusId;
        return (
          <div
            key={r.id}
            ref={focused ? setFocusRef : undefined}
            className={`flex flex-col gap-2 rounded-xl border p-5 transition ${stockCard(
              r.remainingQty,
              r.maxQty,
            )} ${focused ? 'ring-2 ring-[#5ad0ff]' : ''}`}
          >
            {/* Dim only the info when decommissioned — the action buttons
                (esp. Recommission) stay fully clickable. */}
            <div
              className={`flex flex-col gap-2 ${r.isDecommissioned ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="m-0 text-[1.05rem]">{r.name}</h3>
                <span className={`tier tier-${r.minLevel}`}>{r.minLevel}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <p className="m-0 text-[0.9rem] text-[#9fb3d8]">
                  <strong className="text-[1.05rem] text-[#e8eefc]">
                    {r.remainingQty}
                  </strong>{' '}
                  / {r.maxQty} in stock
                </p>
                <span className="text-[0.8rem] text-[#9fb3d8]">
                  {r.isDecommissioned ? 'Decommissioned' : 'Active'}
                </span>
              </div>
            </div>

            {isCrew && (
              <ResourceActions resource={r} className="mt-auto pt-2" {...actions} />
            )}
          </div>
        );
      })}
    </div>
  );
}
