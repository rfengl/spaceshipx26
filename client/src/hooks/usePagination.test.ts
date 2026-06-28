import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { usePagination } from './usePagination';

const items = Array.from({ length: 25 }, (_, i) => i + 1); // 1..25

describe('usePagination (client mode)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('slices the current page and derives the page count', () => {
    const { result } = renderHook(() =>
      usePagination(items, { storageKey: 'k', defaultPageSize: 10 }),
    );

    expect(result.current.pageCount).toBe(3); // ceil(25 / 10)
    expect(result.current.pageItems).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    act(() => result.current.onPage(2));
    expect(result.current.pageItems).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('clamps a page that falls out of range', () => {
    const { result } = renderHook(() =>
      usePagination(items, { storageKey: 'k', defaultPageSize: 10 }),
    );
    act(() => result.current.onPage(99));
    expect(result.current.page).toBe(3); // clamped to the last page
  });

  it('returns to page 1 when the page size changes', () => {
    const { result } = renderHook(() =>
      usePagination(items, { storageKey: 'k', defaultPageSize: 10 }),
    );
    act(() => result.current.onPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.onPageSize(5));
    expect(result.current.page).toBe(1);
    expect(result.current.pageCount).toBe(5); // ceil(25 / 5)
  });

  it('returns to page 1 when the resetKey changes (e.g. a filter)', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) =>
        usePagination(items, { storageKey: 'k', defaultPageSize: 10, resetKey }),
      { initialProps: { resetKey: 'a' } },
    );
    act(() => result.current.onPage(2));
    expect(result.current.page).toBe(2);

    rerender({ resetKey: 'b' });
    expect(result.current.page).toBe(1);
  });

  it('always has at least one page, even when empty', () => {
    const { result } = renderHook(() => usePagination([], { storageKey: 'k' }));
    expect(result.current.pageCount).toBe(1);
    expect(result.current.pageItems).toEqual([]);
  });
});

describe('usePagination (server mode)', () => {
  beforeEach(() => localStorage.clear());

  it('derives the page count from total and leaves slicing to the caller', () => {
    const { result } = renderHook(() =>
      usePagination<number>(null, { storageKey: 'k', defaultPageSize: 10, total: 42 }),
    );
    expect(result.current.pageCount).toBe(5); // ceil(42 / 10)
    expect(result.current.pageItems).toEqual([]); // caller fetches its own page
  });
});
