import type { Resource } from '../../types';

export interface ResourceActionHandlers {
  onAnalytics: (r: Resource) => void;
  onRefill: (r: Resource) => void;
  onWriteOff: (r: Resource) => void;
  onEdit: (r: Resource) => void;
  onToggleDecommission: (r: Resource) => void;
  onDelete: (r: Resource) => void;
}

interface ResourceActionsProps extends ResourceActionHandlers {
  resource: Resource;
  className?: string;
}

const btn =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-[0.95rem] leading-none transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30';

/**
 * Crew resource actions as icon buttons (the label is the tooltip / aria-label),
 * so the full action set fits in tight card and table rows.
 */
export default function ResourceActions({
  resource: r,
  className = '',
  onAnalytics,
  onRefill,
  onWriteOff,
  onEdit,
  onToggleDecommission,
  onDelete,
}: ResourceActionsProps) {
  const full = r.remainingQty >= r.maxQty;
  const empty = r.remainingQty <= 0;
  const dec = r.isDecommissioned;

  return (
    <div className={`flex flex-wrap items-center justify-end gap-1 ${className}`}>
      <button
        type="button"
        className={btn}
        title="Usage trend"
        aria-label="Usage trend"
        onClick={() => onAnalytics(r)}
      >
        {/* Pie-chart glyph linking to this resource's trend page. */}
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <circle
            cx="8"
            cy="8"
            r="6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M8 8 L8 1.5 A6.5 6.5 0 0 1 14.5 8 Z" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        className={btn}
        title="Refill"
        aria-label="Refill"
        disabled={dec || full}
        onClick={() => onRefill(r)}
      >
        ➕
      </button>
      <button
        type="button"
        className={btn}
        title="Write off (spoiled / broken / lost)"
        aria-label="Write off"
        disabled={empty}
        onClick={() => onWriteOff(r)}
      >
        ➖
      </button>
      <button
        type="button"
        className={btn}
        title="Edit"
        aria-label="Edit"
        onClick={() => onEdit(r)}
      >
        ✏️
      </button>
      <button
        type="button"
        className={btn}
        title={dec ? 'Recommission' : 'Decommission'}
        aria-label={dec ? 'Recommission' : 'Decommission'}
        onClick={() => onToggleDecommission(r)}
      >
        {dec ? '▶️' : '⏸️'}
      </button>
      <button
        type="button"
        className={`${btn} hover:bg-[rgba(255,99,99,0.18)]`}
        title="Delete"
        aria-label="Delete"
        onClick={() => onDelete(r)}
      >
        🗑️
      </button>
    </div>
  );
}
