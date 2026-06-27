import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import ConfirmDialog from '../../components/Modal/ConfirmDialog';
import SearchInput from '../../components/SearchInput';
import { useResourceSocket } from '../../hooks/useResourceSocket';
import { sameResource } from '../../utils/sameResource';
import { listMyResources, useResource } from '../../api/resources';
import type { Resource } from '../../types';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

// Stock level → card styling. < 1/3 remaining = critical (red), < 1/2 = low (yellow).
function stock(remaining: number, max: number) {
  const ratio = max > 0 ? remaining / max : 0;
  if (ratio < 1 / 3) {
    return {
      card: 'border-[rgba(255,99,99,0.5)] bg-[rgba(255,80,80,0.14)]',
      label: 'Critical',
      labelColor: 'text-[#ff9d9d]',
    };
  }
  if (ratio < 0.5) {
    return {
      card: 'border-[rgba(255,200,80,0.5)] bg-[rgba(255,200,80,0.13)]',
      label: 'Low',
      labelColor: 'text-[#ffd86b]',
    };
  }
  return {
    card: 'border-white/[0.08] bg-white/[0.04]',
    label: 'In stock',
    labelColor: 'text-[#8ef5b0]',
  };
}

export default function PassengerDashboard() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Resource | null>(null);
  const [busy, setBusy] = useState(false);
  const [grabbingId, setGrabbingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    listMyResources()
      .then(setResources)
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  // Live updates: the server only pushes resources this passenger's tier can
  // access, so we can apply them directly (patch in place, add if new, remove
  // on delete) without refetching. Returning the previous array on a no-op
  // (e.g. a socket echo of our own use) lets React skip the re-render.
  useResourceSocket((change) => {
    if (change.type === 'resource.removed') {
      setResources((prev) =>
        prev.some((r) => r.id === change.resourceId)
          ? prev.filter((r) => r.id !== change.resourceId)
          : prev,
      );
      return;
    }
    const next = change.resource;
    setResources((prev) => {
      const current = prev.find((r) => r.id === next.id);
      if (current && sameResource(current, next)) return prev;
      return current ? prev.map((r) => (r.id === next.id ? next : r)) : [...prev, next];
    });
  });

  async function doUse() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await useResource(pending.id);
      setResources((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setPending(null);
    } catch (e) {
      setError(errMsg(e));
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? resources.filter(
        (r) => r.name.toLowerCase().includes(q) || r.minLevel.toLowerCase().includes(q),
      )
    : resources;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-[1.15rem]">Available resources</h2>
        <Link to="/history" className="back-link">
          My history →
        </Link>
      </div>
      <p className="muted mt-1 text-[0.9rem]">
        Facilities available to your membership tier. Each use consumes one unit.
      </p>

      {error && <p className="error mt-3">⚠ {error}</p>}

      {loading ? (
        <p className="muted mt-4">Loading resources…</p>
      ) : resources.length === 0 ? (
        <p className="muted mt-4">No resources available to your tier yet.</p>
      ) : (
        <>
          <div className="mt-4">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search by name or tier…"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="muted mt-4">No resources match “{query}”.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filtered.map((r) => {
                const decommissioned = r.isDecommissioned;
                const out = r.remainingQty <= 0;
                const disabled = decommissioned || out;
                const s = decommissioned
                  ? {
                      card: 'border-white/[0.08] bg-white/[0.03] opacity-60',
                      label: 'Decommissioned',
                      labelColor: 'text-[#9fb3d8]',
                    }
                  : stock(r.remainingQty, r.maxQty);
                return (
                  <div
                    key={r.id}
                    className={`flex justify-between gap-3 rounded-xl border p-5 ${s.card}`}
                  >
                    <div className="flex flex-col gap-1.5">
                      <h3 className="m-0 text-[1.05rem]">{r.name}</h3>
                      <p className="m-0 text-[0.95rem]">
                        <strong className="text-[1.05rem]">{r.remainingQty}</strong>
                        <span className="text-[#9fb3d8]"> / {r.maxQty} remaining</span>
                      </p>
                      <span
                        className={`text-[0.7rem] font-semibold uppercase tracking-[0.08em] ${s.labelColor}`}
                      >
                        {s.label}
                      </span>
                    </div>
                    <div className="flex flex-col items-end justify-between gap-2">
                      <span className={`tier tier-${r.minLevel}`}>{r.minLevel}</span>
                      <button
                        className="flex cursor-grab items-center gap-1.5 rounded-lg border border-[rgba(90,208,255,0.45)] bg-[rgba(90,208,255,0.12)] px-3.5 py-1.5 text-[0.82rem] font-medium text-[#afe3ff] transition hover:border-[#5ad0ff] hover:bg-[rgba(90,208,255,0.2)] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={disabled}
                        onMouseDown={() => setGrabbingId(r.id)}
                        onMouseUp={() => setGrabbingId(null)}
                        onMouseLeave={() => setGrabbingId(null)}
                        onClick={() => setPending(r)}
                      >
                        {decommissioned ? (
                          'Unavailable'
                        ) : out ? (
                          'Out of stock'
                        ) : (
                          <>
                            <span aria-hidden>{grabbingId === r.id ? '✊' : '✋'}</span>
                            Use
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {pending && (
        <ConfirmDialog
          title="Use resource"
          message={
            <>
              Use one unit of <strong>{pending.name}</strong>? {pending.remainingQty} of{' '}
              {pending.maxQty} remaining.
            </>
          }
          confirmLabel="Use"
          busy={busy}
          onConfirm={() => void doUse()}
          onCancel={() => setPending(null)}
        />
      )}
    </section>
  );
}
