import type { Request } from 'express';

/** A trimmed query-string value, or undefined when absent/blank. */
export const queryString = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

export interface PageParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Parse and clamp `page`/`pageSize` from a request query into a repository's
 * `limit`/`offset`. The paging contract (defaults and ceiling) lives here so
 * every paged endpoint stays consistent.
 */
export function parsePagination(query: Request['query']): PageParams {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(query.pageSize) || DEFAULT_PAGE_SIZE),
  );
  return { page, limit, offset: (page - 1) * limit };
}
