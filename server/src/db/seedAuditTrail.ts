import { randomUUID } from 'node:crypto';

import type { DB } from './connection.js';
import { hasAccess, type MembershipLevel } from '../domain/membership.js';

export interface SimPassenger {
  id: string;
  tier: MembershipLevel;
}

export interface SimResource {
  id: string;
  name: string;
  minLevel: MembershipLevel;
  maxQty: number;
  remaining: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// A daily routine: at each listed hour, an eligible passenger uses the resource
// with `chance` probability. The hours give the data a believable time-of-day
// shape — meals at mealtimes, sleep at night, hygiene morning and evening — so
// the trail reads like a real ship's log rather than a flat stream.
interface Routine {
  resource: string;
  hours: number[];
  chance: number;
  weekendBoost?: number; // leisure picks up at the weekend
}
const ROUTINES: Routine[] = [
  { resource: 'Food Supply Station', hours: [8, 13, 19], chance: 0.92 }, // ~3 meals/day
  { resource: 'Sleeping Pod', hours: [22, 23], chance: 0.35 }, // one rest cycle
  { resource: 'Basic Hygiene Pod', hours: [7, 21], chance: 0.4 }, // morning + night
  { resource: 'Private Cabin', hours: [15, 20], chance: 0.15 }, // occasional retreat
  { resource: 'Advanced Medical Bay', hours: [11], chance: 0.03 }, // rare check-ups
  { resource: 'Luxury Oxygen Pod', hours: [9, 17], chance: 0.4 }, // premium O2
  { resource: 'VIP Rec Deck', hours: [16], chance: 0.3, weekendBoost: 2 }, // leisure
];

const REFILL_BELOW = 0.4; // fraction of capacity that triggers a crew top-up

// Small deterministic PRNG (mulberry32) so the simulated year — and therefore
// every demo and test that reads it — is reproducible from a fixed seed.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simulates a year of ship activity in the audit trail. Rather than a flat loop,
 * it models daily routines (meals, sleep, hygiene, premium facilities) at
 * believable hours with minute-level jitter, layers in day-to-day noise — busy
 * days, quiet days, the odd medical-bay incident, weekend leisure — and has crew
 * leads sweep the ship to refill low stock. Every passenger participates, so all
 * tiers appear in the trail. Each use and refill is applied as its own
 * transaction (the same atomic consume/restore + log the live API performs).
 *
 * `resources[].remaining` is mutated to the final on-hand stock.
 */
export function seedAuditTrail(
  db: DB,
  passengers: SimPassenger[],
  resources: SimResource[],
  crewIds: string[],
  days = 365,
): void {
  const rng = mulberry32(0x5eed);
  const now = Date.now();
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  const base = midnight.getTime();

  const insertAudit = db.prepare(
    'INSERT INTO audit_trail (id, user_id, resource_id, action, amount, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const setRemaining = db.prepare('UPDATE resources SET remaining_qty = ? WHERE id = ?');

  const recordUse = db.transaction((p: SimPassenger, r: SimResource, atMs: number) => {
    if (r.remaining <= 0) return; // out of stock — the use can't happen
    r.remaining -= 1;
    setRemaining.run(r.remaining, r.id);
    insertAudit.run(
      randomUUID(),
      p.id,
      r.id,
      'USE',
      1,
      null,
      new Date(atMs).toISOString(),
    );
  });

  const recordRefill = db.transaction((crewId: string, r: SimResource, atMs: number) => {
    const amount = r.maxQty - r.remaining;
    if (amount <= 0) return;
    r.remaining = r.maxQty;
    setRemaining.run(r.remaining, r.id);
    insertAudit.run(
      randomUUID(),
      crewId,
      r.id,
      'REFILL',
      amount,
      null,
      new Date(atMs).toISOString(),
    );
  });

  const byName = new Map(resources.map((r) => [r.name, r]));
  const eligible = (r: SimResource) =>
    passengers.filter((p) => hasAccess(p.tier, r.minLevel));

  // A timestamp at `hour` ± up to ~40 min of jitter; null if it would be in the
  // future (so today is only filled up to now, not ahead of it).
  const timeAt = (dayStart: number, hour: number): number | null => {
    const ms =
      dayStart +
      hour * HOUR_MS +
      Math.floor((rng() * 80 - 20) * 60_000) +
      Math.floor(rng() * 60_000);
    return ms <= now ? ms : null;
  };

  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo -= 1) {
    const dayStart = base - daysAgo * DAY_MS;
    const dow = new Date(dayStart).getUTCDay();
    const weekend = dow === 0 || dow === 6;

    // A per-day activity multiplier gives the chart visible fluctuation: most
    // days are average, a few are busy, a few are quiet.
    let factor = 0.75 + rng() * 0.5;
    if (rng() < 0.06) factor *= 1.8;
    else if (rng() < 0.06) factor *= 0.45;

    for (const routine of ROUTINES) {
      const r = byName.get(routine.resource);
      if (!r) continue;
      const boost = weekend && routine.weekendBoost ? routine.weekendBoost : 1;
      const chance = routine.chance * factor * boost;
      for (const p of eligible(r)) {
        for (const hour of routine.hours) {
          if (rng() >= chance) continue;
          const at = timeAt(dayStart, hour);
          if (at !== null) recordUse(p, r, at);
        }
      }
    }

    // Occasionally a cluster of medical-bay visits — a visible spike.
    if (rng() < 0.06) {
      const bay = byName.get('Advanced Medical Bay');
      const patients = bay ? eligible(bay) : [];
      for (let i = 2 + Math.floor(rng() * 4); i > 0 && patients.length; i -= 1) {
        const p = patients[Math.floor(rng() * patients.length)];
        const at = timeAt(dayStart, 9 + Math.floor(rng() * 8));
        if (bay && at !== null) recordUse(p, bay, at);
      }
    }

    // Crew sweep the ship every couple of days and top up anything low.
    if (daysAgo % 2 === 0) {
      const crewId = crewIds[Math.floor(rng() * crewIds.length)];
      for (const r of resources) {
        if (r.remaining < r.maxQty * REFILL_BELOW) {
          recordRefill(crewId, r, timeAt(dayStart, 14) ?? now);
        }
      }
    }
  }
}
