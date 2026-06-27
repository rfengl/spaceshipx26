import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { usePersistentState } from '../../hooks/usePersistentState';
import Pagination from '../../components/Pagination';
import { getAuditTrail, type AuditAction, type AuditEntry } from '../../api/audit';
import { listResources } from '../../api/resources';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

const PAGE_SIZE_OPTIONS = [5, 10, 20, 30, 50];

const fmt = (at: string) =>
  new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// Display label + badge colour per activity type.
const ACTION_META: Record<AuditAction, { label: string; cls: string }> = {
  USE: { label: 'Used', cls: 'bg-[rgba(90,208,255,0.18)] text-[#afe3ff]' },
  REFILL: { label: 'Refilled', cls: 'bg-[rgba(120,240,160,0.18)] text-[#8ef5b0]' },
  PROVISION: { label: 'Provisioned', cls: 'bg-[rgba(150,170,255,0.2)] text-[#bcc8ff]' },
  DECOMMISSION: {
    label: 'Decommissioned',
    cls: 'bg-[rgba(255,200,80,0.18)] text-[#ffd86b]',
  },
  RECOMMISSION: {
    label: 'Recommissioned',
    cls: 'bg-[rgba(120,240,160,0.14)] text-[#8ef5b0]',
  },
  DELETE: { label: 'Deleted', cls: 'bg-[rgba(255,99,99,0.18)] text-[#ff9d9d]' },
};

// Quantity shown per activity: −1 for a use, +N for a refill, nothing otherwise.
const qtyLabel = (e: AuditEntry) =>
  e.type === 'USE' ? '−1' : e.type === 'REFILL' ? `+${e.amount}` : '—';

// Distinct {value, label} options for a filter dropdown, sorted by label.
function options(
  entries: AuditEntry[],
  id: (e: AuditEntry) => string,
  name: (e: AuditEntry) => string,
) {
  const map = new Map<string, string>();
  entries.forEach((e) => map.set(id(e), name(e)));
  return [...map]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export default function AuditTrailPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentState('audit.pageSize', 10);

  // Resource filter options come from the live resource list (which excludes
  // soft-deleted resources), so deleted resources aren't filterable — though
  // their past activity still shows under "All".
  const [resourceOptions, setResourceOptions] = useState<
    { value: string; label: string }[]
  >([]);

  useEffect(() => {
    getAuditTrail()
      .then(setEntries)
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    listResources()
      .then((rs) =>
        setResourceOptions(
          rs
            .map((r) => ({ value: r.id, label: r.name }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        ),
      )
      .catch(() => setResourceOptions([]));
  }, []);

  // Passenger options come from the trail itself (so anyone with activity,
  // including soft-deleted passengers, can be selected).
  const passengers = useMemo(
    () =>
      options(
        entries,
        (e) => e.userId,
        (e) => e.userName,
      ),
    [entries],
  );

  const filtered = entries.filter((e) => {
    if (userId && e.userId !== userId) return false;
    if (resourceId && e.resourceId !== resourceId) return false;
    const day = e.at.slice(0, 10); // YYYY-MM-DD
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });

  // Any change to a filter or page size returns to the first page.
  useEffect(() => {
    setPage(1);
  }, [userId, resourceId, from, to, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const hasFilter = Boolean(userId || resourceId || from || to);
  const clear = () => {
    setUserId('');
    setResourceId('');
    setFrom('');
    setTo('');
  };

  const field =
    'flex min-w-0 flex-col gap-1 text-[0.72rem] uppercase tracking-[0.06em] text-[#7f93b8]';

  return (
    <>
      <Link to="/" className="back-link">
        ← Dashboard
      </Link>

      <section className="card">
        <h2 className="m-0 text-[1.1rem]">Audit trail</h2>
        <p className="muted mt-1 text-[0.9rem]">
          Every resource activity — passenger usage, crew refills, and lifecycle changes
          (provision, decommission, recommission, delete).
        </p>

        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className={field}>
            Passenger
            <select
              className="input w-full py-[0.4rem]"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">All</option>
              {passengers.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            Resource
            <select
              className="input w-full py-[0.4rem]"
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
            >
              <option value="">All</option>
              {resourceOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            From
            <input
              type="date"
              className="input w-full py-[0.4rem]"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className={field}>
            To
            <input
              type="date"
              className="input w-full py-[0.4rem]"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>

        {hasFilter && (
          <button
            className="btn-ghost mt-3 px-3 py-[0.45rem] text-[0.85rem]"
            onClick={clear}
          >
            Clear filters
          </button>
        )}

        {error && <p className="error mt-3">⚠ {error}</p>}

        {loading ? (
          <p className="muted mt-4">Loading activity…</p>
        ) : filtered.length === 0 ? (
          <p className="muted mt-4">
            {entries.length === 0
              ? 'No activity recorded yet.'
              : 'No activity matches these filters.'}
          </p>
        ) : (
          <>
            <table className="data-table mt-4">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Activity</th>
                  <th>Resource</th>
                  <th>Passenger</th>
                  <th className="num">Qty</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((e) => {
                  const meta = ACTION_META[e.type];
                  return (
                    <tr key={e.id}>
                      <td data-label="When">{fmt(e.at)}</td>
                      <td data-label="Activity">
                        <span
                          className={`rounded px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.06em] ${meta.cls}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td data-label="Resource">{e.resourceName}</td>
                      <td data-label="Passenger">{e.userName}</td>
                      <td className="num" data-label="Qty">
                        {qtyLabel(e)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <label className="flex items-center gap-2 text-[0.8rem] text-[#9fb3d8]">
                Rows per page
                <select
                  className="input py-[0.4rem]"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <Pagination page={safePage} pageCount={pageCount} onPage={setPage} />
            </div>
          </>
        )}
      </section>
    </>
  );
}
