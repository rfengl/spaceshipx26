import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MEMBERSHIP_LEVELS,
  hasAccess,
  isMembershipLevel,
  tierRank,
  type MembershipLevel,
} from '../src/domain/membership.js';

test('tiers rank Silver < Gold < Platinum', () => {
  assert.ok(tierRank('SILVER') < tierRank('GOLD'));
  assert.ok(tierRank('GOLD') < tierRank('PLATINUM'));
});

// The access matrix: a member of `userLevel` may reach a resource needing
// `minLevel` iff their tier is at least as high — higher tiers inherit downward.
const ACCESSIBLE: Record<MembershipLevel, MembershipLevel[]> = {
  SILVER: ['SILVER'],
  GOLD: ['SILVER', 'GOLD'],
  PLATINUM: ['SILVER', 'GOLD', 'PLATINUM'],
};

test('higher tiers inherit access to every lower tier, and only those', () => {
  for (const userLevel of MEMBERSHIP_LEVELS) {
    for (const minLevel of MEMBERSHIP_LEVELS) {
      const expected = ACCESSIBLE[userLevel].includes(minLevel);
      assert.equal(
        hasAccess(userLevel, minLevel),
        expected,
        `${userLevel} accessing a ${minLevel} resource should be ${expected}`,
      );
    }
  }
});

test('every tier can access its own level', () => {
  for (const level of MEMBERSHIP_LEVELS) {
    assert.ok(hasAccess(level, level), `${level} should access its own tier`);
  }
});

test('a lower tier cannot reach a higher tier resource', () => {
  assert.equal(hasAccess('SILVER', 'GOLD'), false);
  assert.equal(hasAccess('SILVER', 'PLATINUM'), false);
  assert.equal(hasAccess('GOLD', 'PLATINUM'), false);
});

test('isMembershipLevel accepts the known tiers', () => {
  for (const level of MEMBERSHIP_LEVELS) {
    assert.ok(isMembershipLevel(level));
  }
});

test('isMembershipLevel rejects anything else', () => {
  for (const bad of ['silver', 'BRONZE', 'gold', '', null, undefined, 3, {}, []]) {
    assert.equal(isMembershipLevel(bad), false, `${String(bad)} is not a tier`);
  }
});
