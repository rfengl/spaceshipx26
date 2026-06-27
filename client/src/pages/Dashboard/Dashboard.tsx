import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getShortages } from '../../api/resources';
import { useResourceSocket } from '../../hooks/useResourceSocket';
import type { Resource } from '../../types';

const NAV_ITEMS = [
  {
    to: '/resources',
    icon: '🛰️',
    title: 'Resources',
    description: 'Ship inventory and the membership tier each one requires.',
  },
  {
    to: '/passengers',
    icon: '🧑‍🚀',
    title: 'Passengers',
    description: 'Passenger profiles and their membership levels.',
  },
  {
    to: '/crew-leads',
    icon: '🎖️',
    title: 'Crew Leads',
    description: 'The administrators managing the ship (exactly three).',
  },
  {
    to: '/audit-trail',
    icon: '🧾',
    title: 'Audit Trail',
    description: 'Every resource activity — passenger usage and crew refills.',
  },
  {
    to: '/reports',
    icon: '📊',
    title: 'Aggregated Reports',
    description: 'Ship-wide resource distribution by passenger tier.',
  },
];

// Colour cards by remaining stock so the worst shortages stand out.
function stockCard(remaining: number, max: number) {
  const ratio = max > 0 ? remaining / max : 0;
  if (ratio < 1 / 3) return 'border-[rgba(255,99,99,0.5)] bg-[rgba(255,80,80,0.12)]';
  if (ratio < 0.5) return 'border-[rgba(255,200,80,0.5)] bg-[rgba(255,200,80,0.11)]';
  return 'border-white/[0.08] bg-white/[0.04]';
}

export default function Dashboard() {
  const [shortages, setShortages] = useState<Resource[]>([]);

  const loadShortages = () => {
    getShortages()
      .then(setShortages)
      .catch(() => setShortages([]));
  };

  useEffect(() => {
    loadShortages();
  }, []);

  // Live "lowest stock" panel. Any resource change can re-rank this list — a
  // refill lifts an item out, a use can push a new one in — and the ranking
  // spans the whole inventory, which this view doesn't hold. So the correct
  // live behaviour is to refetch the ranked subset, not patch a single row.
  useResourceSocket((change) => {
    if (change.type === 'resource.updated' || change.type === 'resource.removed') {
      loadShortages();
    }
  });

  return (
    <>
      {shortages.length > 0 && (
        <section className="mt-6">
          <h2 className="m-0 text-[1.15rem]">⚠️ Lowest stock</h2>
          <p className="muted mt-1 text-[0.9rem]">
            Running low — open a card to refill it on the Resources page.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {shortages.map((r) => (
              <Link
                key={r.id}
                to={`/resources?focus=${r.id}`}
                className={`flex flex-col gap-1.5 rounded-xl border p-5 text-inherit no-underline transition hover:-translate-y-0.5 hover:border-[#5ad0ff] ${stockCard(
                  r.remainingQty,
                  r.maxQty,
                )}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="m-0 text-[0.9rem]">
                    <strong className="text-[1.15rem]">{r.remainingQty}</strong>
                    <span className="text-[#9fb3d8]"> / {r.maxQty} left</span>
                  </p>
                  <span className={`tier tier-${r.minLevel}`}>{r.minLevel}</span>
                </div>
                <h3 className="m-0 text-[1.02rem]">{r.name}</h3>
                <p className="m-0 text-[0.82rem] text-[#5ad0ff]">Refill →</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-col gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-6 text-inherit no-underline transition hover:-translate-y-0.5 hover:border-[#5ad0ff] hover:bg-[rgba(90,208,255,0.08)]"
          >
            <span className="text-[1.9rem]">{item.icon}</span>
            <h2 className="mb-0 mt-1 text-[1.15rem]">{item.title}</h2>
            <p className="m-0 text-[0.85rem] text-[#9fb3d8]">{item.description}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
