import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import RefillModal from '../../../src/pages/Resources/RefillModal';
import type { Resource } from '../../../src/types';

// room to add = maxQty - remainingQty = 10 - 6 = 4
const resource: Resource = {
  id: 'r1',
  name: 'Food Station',
  minLevel: 'SILVER',
  maxQty: 10,
  remainingQty: 6,
  active: true,
  isDecommissioned: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const renderModal = () => {
  const onClose = vi.fn();
  const onApplied = vi.fn();
  render(<RefillModal resource={resource} onClose={onClose} onApplied={onApplied} />);
  return { onClose, onApplied };
};

const amountInput = () => screen.getByLabelText('Refill amount') as HTMLInputElement;

afterEach(cleanup);

describe('RefillModal amount clamping', () => {
  it('starts at one unit', () => {
    renderModal();
    expect(amountInput().value).toBe('1');
  });

  it('clamps an amount above the available room down to the room', () => {
    renderModal();
    fireEvent.change(amountInput(), { target: { value: '999' } });
    expect(amountInput().value).toBe('4'); // capped at maxQty - remainingQty
  });

  it('clamps a zero or empty amount up to one', () => {
    renderModal();
    fireEvent.change(amountInput(), { target: { value: '0' } });
    expect(amountInput().value).toBe('1');
  });

  it('keeps an in-range amount unchanged', () => {
    renderModal();
    fireEvent.change(amountInput(), { target: { value: '3' } });
    expect(amountInput().value).toBe('3');
  });

  it('"Fill to max" tops the amount up to the full available room', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /fill to max/i }));
    expect(amountInput().value).toBe('4');
    // the submit button reflects the chosen amount
    expect(screen.getByRole('button', { name: 'Add 4' })).toBeDefined();
  });
});
