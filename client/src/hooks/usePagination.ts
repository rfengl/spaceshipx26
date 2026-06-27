import { useEffect, useState } from 'react';

import { usePersistentState } from './usePersistentState';

interface PaginationOptions {
  /** localStorage key for the persisted page size, e.g. "resources.pageSize". */
  storageKey: string;
  defaultPageSize?: number;
  total?: number;
  /** When this changes (e.g. filters / sort), paging jumps back to page 1. */
  resetKey?: string;
}

export interface Pagination<T> {
  /** The current page's items. */
  paged: T[];
  /** Bundle to spread straight into `<PaginationBar {...paging} />`. */
  paging: {
    page: number; // current page, clamped into range
    pageCount: number;
    pageSize: number;
    onPage: (page: number) => void;
    onPageSize: (size: number) => void;
  };
}

/**
 * Page-size + current-page state and the derived slice for a list. The page
 * size persists per list; changing the filters/sort (`resetKey`) or the page
 * size returns to the first page, and the current page is always kept in range.
 */
export function usePagination<T>(
  items: T[] | null,
  { storageKey, defaultPageSize = 10, total = 0, resetKey }: PaginationOptions,
): Pagination<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentState(storageKey, defaultPageSize);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const pageCount = Math.max(1, Math.ceil((items?.length || total) / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = items ? items.slice((safePage - 1) * pageSize, safePage * pageSize) : [];

  return {
    paged,
    paging: {
      page: safePage,
      pageCount,
      pageSize,
      onPage: setPage,
      onPageSize: setPageSize,
    },
  };
}
