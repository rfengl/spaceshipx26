import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

import { useAsyncLoad } from '../../src/hooks/useAsyncLoad';

afterEach(cleanup);

// A tiny harness that surfaces the hook's lifecycle as DOM text/buttons, so we
// can assert on it without reaching into React internals. The loaded value is
// captured via the `onLoad` callback, exactly as a real page would own it.
function Harness<T>({
  loader,
  deps,
  onLoad,
}: {
  loader: () => Promise<T>;
  deps?: unknown[];
  onLoad: (data: T) => void;
}) {
  const { loading, error, reload } = useAsyncLoad(loader, onLoad, deps);
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error ?? ''}</span>
      <button onClick={reload}>reload</button>
    </div>
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;

describe('useAsyncLoad', () => {
  it('starts loading, then hands the resolved value to onLoad', async () => {
    const onLoad = vi.fn();
    render(<Harness loader={() => Promise.resolve('hello')} onLoad={onLoad} />);

    expect(text('loading')).toBe('true');
    expect(onLoad).not.toHaveBeenCalled();

    await waitFor(() => expect(text('loading')).toBe('false'));
    expect(onLoad).toHaveBeenCalledWith('hello');
    expect(text('error')).toBe('');
  });

  it('captures a thrown value as a user-facing error and skips onLoad', async () => {
    const onLoad = vi.fn();
    render(<Harness loader={() => Promise.reject(new Error('boom'))} onLoad={onLoad} />);

    await waitFor(() => expect(text('loading')).toBe('false'));
    expect(text('error')).toBe('boom');
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('re-runs the loader when reload() is called', async () => {
    const loader = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const onLoad = vi.fn();
    render(<Harness loader={loader} onLoad={onLoad} />);

    await waitFor(() => expect(onLoad).toHaveBeenCalledWith('first'));

    fireEvent.click(screen.getByRole('button', { name: 'reload' }));

    await waitFor(() => expect(onLoad).toHaveBeenCalledWith('second'));
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('re-runs the loader when deps change', async () => {
    const onLoad = vi.fn();
    const { rerender } = render(
      <Harness loader={() => Promise.resolve('item-1')} deps={[1]} onLoad={onLoad} />,
    );
    await waitFor(() => expect(onLoad).toHaveBeenCalledWith('item-1'));

    rerender(
      <Harness loader={() => Promise.resolve('item-2')} deps={[2]} onLoad={onLoad} />,
    );
    await waitFor(() => expect(onLoad).toHaveBeenCalledWith('item-2'));
  });

  it('ignores a stale response that resolves after a newer load (out-of-order guard)', async () => {
    // First load resolves slowly; the dep change kicks off a fast second load.
    // The slow first response must not reach onLoad after the newer value.
    let resolveSlow: (v: string) => void = () => {};
    const slow = new Promise<string>((r) => {
      resolveSlow = r;
    });
    const onLoad = vi.fn();
    const loaders = [() => slow, () => Promise.resolve('fresh')];

    const { rerender } = render(
      <Harness loader={loaders[0]} deps={[0]} onLoad={onLoad} />,
    );
    rerender(<Harness loader={loaders[1]} deps={[1]} onLoad={onLoad} />);

    await waitFor(() => expect(onLoad).toHaveBeenCalledWith('fresh'));

    // The earlier, now-superseded load finally resolves — it should be dropped.
    resolveSlow('stale');
    await Promise.resolve();
    expect(onLoad).not.toHaveBeenCalledWith('stale');
  });
});
