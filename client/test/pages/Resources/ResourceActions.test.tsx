import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import ResourceActions from '../../../src/pages/Resources/ResourceActions';
import type { Resource } from '../../../src/types';

const resource = (over: Partial<Resource> = {}): Resource => ({
  id: 'r1',
  name: 'Food Station',
  minLevel: 'SILVER',
  maxQty: 10,
  remainingQty: 6,
  active: true,
  isDecommissioned: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const renderActions = (r: Resource) => {
  const handlers = {
    onRefill: vi.fn(),
    onWriteOff: vi.fn(),
    onEdit: vi.fn(),
    onToggleDecommission: vi.fn(),
    onDelete: vi.fn(),
  };
  render(<ResourceActions resource={r} {...handlers} />);
  return handlers;
};

const button = (name: string) =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

afterEach(cleanup);

describe('ResourceActions', () => {
  it('disables Refill when the resource is already full', () => {
    renderActions(resource({ remainingQty: 10, maxQty: 10 }));
    expect(button('Refill').disabled).toBe(true);
  });

  it('disables Refill when the resource is decommissioned', () => {
    renderActions(resource({ remainingQty: 2, isDecommissioned: true }));
    expect(button('Refill').disabled).toBe(true);
  });

  it('allows Refill and reports the resource when there is room in service', () => {
    const { onRefill } = renderActions(resource({ remainingQty: 6, maxQty: 10 }));
    const refill = button('Refill');
    expect(refill.disabled).toBe(false);
    fireEvent.click(refill);
    expect(onRefill).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
  });

  it('disables Write off when stock is empty', () => {
    renderActions(resource({ remainingQty: 0 }));
    expect(button('Write off').disabled).toBe(true);
  });

  it('allows Write off when stock remains', () => {
    const { onWriteOff } = renderActions(resource({ remainingQty: 3 }));
    expect(button('Write off').disabled).toBe(false);
    fireEvent.click(button('Write off'));
    expect(onWriteOff).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
  });

  it('labels the toggle Decommission in service and Recommission out of service', () => {
    const { rerender } = render(
      <ResourceActions
        resource={resource({ isDecommissioned: false })}
        onRefill={vi.fn()}
        onWriteOff={vi.fn()}
        onEdit={vi.fn()}
        onToggleDecommission={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Decommission' })).toBeDefined();

    rerender(
      <ResourceActions
        resource={resource({ isDecommissioned: true })}
        onRefill={vi.fn()}
        onWriteOff={vi.fn()}
        onEdit={vi.fn()}
        onToggleDecommission={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Recommission' })).toBeDefined();
  });

  it('reports edit and delete for the resource', () => {
    const { onEdit, onDelete } = renderActions(resource());
    fireEvent.click(button('Edit'));
    fireEvent.click(button('Delete'));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
  });
});
