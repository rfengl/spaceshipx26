import { describe, it, expect } from 'vitest';

import { sameResource } from './sameResource';
import type { Resource } from '../types';

const base: Resource = {
  id: 'r1',
  name: 'Food Station',
  minLevel: 'SILVER',
  maxQty: 10,
  remainingQty: 6,
  active: true,
  isDecommissioned: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('sameResource', () => {
  it('is true for value-identical resources', () => {
    expect(sameResource(base, { ...base })).toBe(true);
  });

  it('is false when any compared field differs', () => {
    expect(sameResource(base, { ...base, remainingQty: 5 })).toBe(false);
    expect(sameResource(base, { ...base, name: 'Water' })).toBe(false);
    expect(sameResource(base, { ...base, isDecommissioned: true })).toBe(false);
    expect(sameResource(base, { ...base, active: false })).toBe(false);
  });
});
