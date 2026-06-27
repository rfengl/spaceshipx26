import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { usePersistentState } from '../../hooks/usePersistentState';
import Pagination from '../../components/Pagination';
import { getAuditTrail, type AuditEntry } from '../../api/audit';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

const PAGE_SIZE_OPTIONS = [5, 10, 20, 30, 50];

const fmt = (at: string) =>
  new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

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

  useEffect(() => {
    getAuditTrail()
      .then(setEntries)
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  // Build dropdowns from the full data so they stay stable while filtering.
  const passengers = useMemo(
    () =>
      options(
        entries,
        (e) => e.userId,
        (e) => e.userName,
      ),
    [entries],
  );
  const resources = useMemo(
    () =>
      options(
        entries,
        (e) => e.resourceId,
        (e) => e.resourceName,
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
          Every resource activity — passenger usage and crew refills.
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
              {resources.map((o) => (
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
                  const refill = e.type === 'REFILL';
                  return (
                    <tr key={e.id}>
                      <td data-label="When">{fmt(e.at)}</td>
                      <td data-label="Activity">
                        <span
                          className={`rounded px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.06em] ${
                            refill
                              ? 'bg-[rgba(120,240,160,0.18)] text-[#8ef5b0]'
                              : 'bg-[rgba(90,208,255,0.18)] text-[#afe3ff]'
                          }`}
                        >
                          {refill ? 'Refilled' : 'Used'}
                        </span>
                      </td>
                      <td data-label="Resource">{e.resourceName}</td>
                      <td data-label="Passenger">{e.userName}</td>
                      <td className="num" data-label="Qty">
                        {refill ? `+${e.amount}` : `−${e.amount}`}
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
