import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import WriteOffModal from '../../../src/pages/Resources/WriteOffModal';
import type { Resource } from '../../../src/types';

// remaining stock = 5 — the most that can be written off.
const resource: Resource = {
  id: 'r1',
  name: 'Food Station',
  minLevel: 'SILVER',
  maxQty: 10,
  remainingQty: 5,
  active: true,
  isDecommissioned: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const renderModal = () => {
  const onClose = vi.fn();
  const onApplied = vi.fn();
  render(<WriteOffModal resource={resource} onClose={onClose} onApplied={onApplied} />);
  return { onClose, onApplied };
};

const amountInput = () =>
  screen.getByLabelText('Amount to write off') as HTMLInputElement;
const reasonSelect = () => screen.getByLabelText('Reason') as HTMLSelectElement;

afterEach(cleanup);

describe('WriteOffModal amount clamping', () => {
  it('starts at one unit', () => {
    renderModal();
    expect(amountInput().value).toBe('1');
  });

  it('clamps an amount above the remaining stock down to what is left', () => {
    renderModal();
    fireEvent.change(amountInput(), { target: { value: '999' } });
    expect(amountInput().value).toBe('5'); // capped at remainingQty
  });

  it('clamps a zero or empty amount up to one', () => {
    renderModal();
    fireEvent.change(amountInput(), { target: { value: '0' } });
    expect(amountInput().value).toBe('1');
  });

  it('keeps an in-range amount unchanged and reflects it on the submit button', () => {
    renderModal();
    fireEvent.change(amountInput(), { target: { value: '3' } });
    expect(amountInput().value).toBe('3');
    expect(screen.getByRole('button', { name: 'Write off 3' })).toBeDefined();
  });
});

describe('WriteOffModal reason', () => {
  it('defaults to the first reason and can be changed', () => {
    renderModal();
    expect(reasonSelect().value).toBe('Expired');
    fireEvent.change(reasonSelect(), { target: { value: 'Broken' } });
    expect(reasonSelect().value).toBe('Broken');
  });
});
