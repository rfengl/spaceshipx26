import { useEffect, useState } from 'react';

import { usePersistentState } from './usePersistentState';

interface PaginationOptions {
  /** localStorage key for the persisted page size, e.g. "resources.pageSize". */
  storageKey: string;
  defaultPageSize?: number;
  /**
   * Server-side mode: total matching rows when the list isn't held in the
   * client (pass `items = null`). Ignored when `items` is provided.
   */
  total?: number;
  /** When this changes (e.g. filters / sort), paging jumps back to page 1. */
  resetKey?: string;
}

export interface PaginationResult<T> {
  /** The current page's items (empty in server mode — the caller fetches them). */
  pageItems: T[];
  // The rest spread straight into `<Pagination {...paging} />`:
  page: number; // current page, clamped into range
  pageCount: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}

/**
 * Page-size + current-page state for a list, in either of two modes:
 *
 * - **Client:** pass the full `items` array; `paged` is the current slice and
 *   the page count is derived from `items.length`.
 * - **Server:** pass `items = null` and a `total` (matching-row count); the
 *   caller fetches its own page, so `paged` is empty and the page count is
 *   derived from `total`.
 *
 * In both modes the page size persists per list; changing the filters/sort
 * (`resetKey`) or the page size returns to the first page, and the current page
 * is always kept in range.
 */
export function usePagination<T>(
  items: T[] | null,
  { storageKey, defaultPageSize = 10, total = 0, resetKey }: PaginationOptions,
): PaginationResult<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentState(storageKey, defaultPageSize);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const count = items ? items.length : total;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = items
    ? items.slice((safePage - 1) * pageSize, safePage * pageSize)
    : [];

  return {
    pageItems,
    page: safePage,
    pageCount,
    pageSize,
    onPage: setPage,
    onPageSize: setPageSize,
  };
}
