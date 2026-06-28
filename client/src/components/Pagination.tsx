export const DEFAULT_PAGE_SIZES = [5, 10, 20, 30, 50];

interface PaginationProps {
  page: number; // 1-based current page
  pageCount: number;
  onPage: (page: number) => void;
  pageSize: number;
  onPageSize: (size: number) => void;
  pageSizeOptions?: number[];
}

/**
 * Standard list footer: a "Rows per page" selector on the left and a
 * prev / "Page X of Y" / next navigator on the right. The navigator is hidden
 * when there's only a single page; the page-size selector is always shown.
 */
export default function Pagination({
  page,
  pageCount,
  onPage,
  pageSize,
  onPageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
}: PaginationProps) {
  const btn =
    'btn-ghost px-3 py-1 text-[0.85rem] disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <label className="flex items-center gap-2 text-[0.8rem] text-[#9fb3d8]">
        Rows per page
        <select
          className="input py-[0.4rem]"
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-4">
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
      )}
    </div>
  );
}
