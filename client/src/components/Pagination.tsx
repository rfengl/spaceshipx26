interface PaginationProps {
  page: number; // 1-based current page
  pageCount: number;
  onPage: (page: number) => void;
  className?: string;
}

/** Prev / "Page X of Y" / Next control. Renders nothing for a single page. */
export default function Pagination({
  page,
  pageCount,
  onPage,
  className = '',
}: PaginationProps) {
  if (pageCount <= 1) return null;
  const btn =
    'btn-ghost px-3 py-1 text-[0.85rem] disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className={`flex items-center justify-center gap-4 ${className}`}>
      <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Prev
      </button>
      <span className="muted text-[0.85rem]">
        Page {page} of {pageCount}
      </span>
      <button
        className={btn}
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        Next →
      </button>
    </div>
  );
}
