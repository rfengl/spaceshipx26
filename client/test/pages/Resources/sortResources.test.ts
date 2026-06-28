import { describe, it, expect } from 'vitest';

import { sortResources } from '../../../src/pages/Resources/sortResources';
import type { Resource } from '../../../src/types';

const make = (over: Partial<Resource>): Resource => ({
  id: 'x',
  name: 'X',
  minLevel: 'SILVER',
  maxQty: 10,
  remainingQty: 5,
  active: true,
  isDecommissioned: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const names = (list: Resource[]) => list.map((r) => r.name);
const ids = (list: Resource[]) => list.map((r) => r.id);

describe('sortResources', () => {
  it('sorts by name ascending by default', () => {
    const list = [make({ name: 'Banana' }), make({ name: 'Apple' })];
    expect(names(sortResources(list, 'name', 'asc', {}))).toEqual(['Apple', 'Banana']);
  });

  it('reverses with the descending direction', () => {
    const list = [make({ name: 'Apple' }), make({ name: 'Banana' })];
    expect(names(sortResources(list, 'name', 'desc', {}))).toEqual(['Banana', 'Apple']);
  });

  it('sorts by remaining stock (lowest first when ascending)', () => {
    const list = [make({ remainingQty: 9 }), make({ remainingQty: 1 })];
    expect(
      sortResources(list, 'remainingQty', 'asc', {}).map((r) => r.remainingQty),
    ).toEqual([1, 9]);
  });

  it('ranks by high demand, most-used first when ascending', () => {
    const list = [make({ id: 'a' }), make({ id: 'b' })];
    expect(ids(sortResources(list, 'highDemand', 'asc', { a: 1, b: 5 }))).toEqual([
      'b',
      'a',
    ]);
  });

  it('breaks ties by name so the order is deterministic', () => {
    // Same remaining stock — the result must fall back to name order,
    // independent of the order the items came in.
    const list = [
      make({ id: 'z', name: 'Zulu', remainingQty: 5 }),
      make({ id: 'a', name: 'Alpha', remainingQty: 5 }),
    ];
    expect(names(sortResources(list, 'remainingQty', 'asc', {}))).toEqual([
      'Alpha',
      'Zulu',
    ]);
  });
});
