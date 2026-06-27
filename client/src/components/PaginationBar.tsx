import Pagination from './Pagination';

export const DEFAULT_PAGE_SIZES = [5, 10, 20, 30, 50];

interface PaginationBarProps {
  page: number; // 1-based current page
  pageCount: number;
  onPage: (page: number) => void;
  pageSize: number;
  onPageSize: (size: number) => void;
  pageSizeOptions?: number[];
}

/**
 * Standard list footer: a "Rows per page" selector on the left and the page
 * navigator on the right. The navigator hides itself when there's a single
 * page; the page-size selector is always shown.
 */
export default function PaginationBar({
  page,
  pageCount,
  onPage,
  pageSize,
  onPageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
}: PaginationBarProps) {
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
      <Pagination page={page} pageCount={pageCount} onPage={onPage} />
    </div>
  );
}
