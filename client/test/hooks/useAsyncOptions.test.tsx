import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

import { useAsyncOptions, type Option } from '../../src/hooks/useAsyncOptions';

afterEach(cleanup);

// Renders the returned options as list items so we can assert on labels.
function Harness<T>({
  loader,
  toOptions,
  deps,
}: {
  loader: () => Promise<T>;
  toOptions: (data: T) => Option[];
  deps?: unknown[];
}) {
  const options = useAsyncOptions(loader, toOptions, deps);
  return (
    <ul>
      {options.map((o) => (
        <li key={o.value}>{o.label}</li>
      ))}
    </ul>
  );
}

const labels = () => screen.queryAllByRole('listitem').map((li) => li.textContent);

describe('useAsyncOptions', () => {
  it('maps the loaded data to options', async () => {
    render(
      <Harness
        loader={() => Promise.resolve([{ id: 'a', name: 'Alpha' }])}
        toOptions={(rs) => rs.map((r) => ({ value: r.id, label: r.name }))}
      />,
    );

    expect(labels()).toEqual([]); // empty until the load resolves
    await waitFor(() => expect(labels()).toEqual(['Alpha']));
  });

  it('swallows a failed load and stays empty', async () => {
    const onLoad = vi.fn();
    render(
      <Harness
        loader={() => Promise.reject(new Error('boom'))}
        toOptions={(rs: { id: string; name: string }[]) => {
          onLoad();
          return rs.map((r) => ({ value: r.id, label: r.name }));
        }}
      />,
    );

    // Give the rejection a tick to settle; it must not throw or map anything.
    await Promise.resolve();
    await Promise.resolve();
    expect(labels()).toEqual([]);
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('re-runs the loader when deps change', async () => {
    const loader = vi.fn((id: number) =>
      Promise.resolve([{ id: String(id), name: `R${id}` }]),
    );
    const toOptions = (rs: { id: string; name: string }[]) =>
      rs.map((r) => ({ value: r.id, label: r.name }));

    const { rerender } = render(
      <Harness loader={() => loader(1)} toOptions={toOptions} deps={[1]} />,
    );
    await waitFor(() => expect(labels()).toEqual(['R1']));

    rerender(<Harness loader={() => loader(2)} toOptions={toOptions} deps={[2]} />);
    await waitFor(() => expect(labels()).toEqual(['R2']));
  });
});
