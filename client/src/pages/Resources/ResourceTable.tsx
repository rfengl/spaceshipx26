import ResourceActions, { type ResourceActionHandlers } from './ResourceActions';
import type { Resource } from '../../types';

// Shortage hint as a cell background. Set on the cells rather than the <tr>
// because a row background paints unreliably under border-collapse.
function stockRowBg(remaining: number, max: number) {
  const ratio = max > 0 ? remaining / max : 0;
  if (ratio < 1 / 3) return '[&>td]:bg-[rgba(255,80,80,0.12)]';
  if (ratio < 0.5) return '[&>td]:bg-[rgba(255,200,80,0.1)]';
  return '';
}

// The focused row (arrived-at from a dashboard shortage card) gets a coloured
// left-edge border, kept separate from the shortage background so both show.
const FOCUS_ACCENT =
  '[&>td:first-child]:border-l-[3px] [&>td:first-child]:border-l-[#5ad0ff]';

interface Props extends ResourceActionHandlers {
  items: Resource[];
  isCrew: boolean;
  focusId: string | null;
  setFocusRef: (el: HTMLElement | null) => void;
}

/** Desktop (md+) view: resources as a sortable table. Crew see the action column. */
export default function ResourceTable({
  items,
  isCrew,
  focusId,
  setFocusRef,
  ...actions
}: Props) {
  return (
    <table className="data-table mt-4">
      <thead>
        <tr>
          <th>Name</th>
          <th>Min tier</th>
          <th className="num">Stock</th>
          <th>Status</th>
          {isCrew && <th aria-label="Actions" />}
        </tr>
      </thead>
      <tbody>
        {items.map((r) => {
          const focused = r.id === focusId;
          return (
            <tr
              key={r.id}
              ref={focused ? setFocusRef : undefined}
              className={`${focused ? FOCUS_ACCENT : ''} ${stockRowBg(
                r.remainingQty,
                r.maxQty,
              )}`}
            >
              <td data-label="Name">{r.name}</td>
              <td data-label="Min tier">
                <span className={`tier tier-${r.minLevel}`}>{r.minLevel}</span>
              </td>
              <td className="num" data-label="Stock">
                {r.remainingQty} / {r.maxQty}
              </td>
              <td data-label="Status">
                {r.isDecommissioned ? 'Decommissioned' : 'Active'}
              </td>
              {isCrew && (
                <td data-label="Actions">
                  <ResourceActions resource={r} {...actions} />
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
