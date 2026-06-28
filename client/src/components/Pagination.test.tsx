import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import Pagination from './Pagination';

afterEach(cleanup);

const setup = (override = {}) => {
  const onPage = vi.fn();
  const onPageSize = vi.fn();
  render(
    <Pagination
      page={2}
      pageCount={5}
      pageSize={10}
      onPage={onPage}
      onPageSize={onPageSize}
      {...override}
    />,
  );
  return { onPage, onPageSize };
};

describe('Pagination', () => {
  it('shows the current page position', () => {
    setup();
    expect(screen.getByText('Page 2 of 5')).toBeDefined();
  });

  it('steps to the previous and next page', () => {
    const { onPage } = setup();
    fireEvent.click(screen.getByRole('button', { name: /prev/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onPage).toHaveBeenNthCalledWith(1, 1);
    expect(onPage).toHaveBeenNthCalledWith(2, 3);
  });

  it('disables Prev on the first page and Next on the last', () => {
    const { onPage } = setup({ page: 1 });
    const prev = screen.getByRole('button', { name: /prev/i }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    fireEvent.click(prev);
    expect(onPage).not.toHaveBeenCalled();
  });

  it('hides the navigator when there is only one page', () => {
    setup({ page: 1, pageCount: 1 });
    expect(screen.queryByText(/Page 1 of 1/)).toBeNull();
    // the page-size selector stays visible
    expect(screen.getByText('Rows per page')).toBeDefined();
  });

  it('reports a new page size from the selector', () => {
    const { onPageSize } = setup();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '20' } });
    expect(onPageSize).toHaveBeenCalledWith(20);
  });
});
