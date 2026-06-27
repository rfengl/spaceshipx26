import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { usePersistentState } from '../../hooks/usePersistentState';
import Pagination from '../../components/Pagination';
import { getMyHistory, type AuditEntry } from '../../api/audit';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

const PAGE_SIZE_OPTIONS = [5, 10, 20, 30, 50];

const fmt = (at: string) =>
  new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function PersonalHistoryPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [resourceId, setResourceId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentState('history.pageSize', 10);

  useEffect(() => {
    getMyHistory()
      .then(setEntries)
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  // Count uses per resource — drives both the dropdown and the trend summary.
  const groupByResource = (list: AuditEntry[]) => {
    const counts = new Map<string, { name: string; uses: number }>();
    list.forEach((e) => {
      const cur = counts.get(e.resourceId) ?? { name: e.resourceName, uses: 0 };
      cur.uses += 1;
      counts.set(e.resourceId, cur);
    });
    return [...counts.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.uses - a.uses);
  };

  // Dropdown options stay stable (from all entries) regardless of the filters.
  const resourceOptions = useMemo(() => groupByResource(entries), [entries]);

  const filtered = entries.filter((e) => {
    if (resourceId && e.resourceId !== resourceId) return false;
    const day = e.at.slice(0, 10); // YYYY-MM-DD
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });

  // The summary reflects the active filters (so the date range affects totals).
  const summary = groupByResource(filtered);

  useEffect(() => {
    setPage(1);
  }, [resourceId, from, to, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const hasFilter = Boolean(resourceId || from || to);
  const clear = () => {
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
        <h2 className="m-0 text-[1.1rem]">My history</h2>
        <p className="muted mt-1 text-[0.9rem]">
          Your personal resource-consumption log and well-being trends.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className={field}>
            Resource
            <select
              className="input w-full py-[0.4rem]"
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
            >
              <option value="">All</option>
              {resourceOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
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

        {/* Consumption trend summary — reflects the active filters. */}
        {!loading && filtered.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[0.8rem]">
              <strong className="text-[#bcd4ff]">{filtered.length}</strong>{' '}
              <span className="text-[#9fb3d8]">total uses</span>
            </span>
            {summary.slice(0, 4).map((r) => (
              <span
                key={r.id}
                className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[0.8rem]"
              >
                {r.name} <strong className="text-[#8ef5b0]">×{r.uses}</strong>
              </span>
            ))}
          </div>
        )}

        {error && <p className="error mt-3">⚠ {error}</p>}

        {loading ? (
          <p className="muted mt-4">Loading history…</p>
        ) : filtered.length === 0 ? (
          <p className="muted mt-4">
            {entries.length === 0
              ? 'You have not used any resources yet.'
              : 'No activity matches these filters.'}
          </p>
        ) : (
          <>
            <table className="data-table mt-4">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Resource</th>
                  <th className="num">Units</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((e) => (
                  <tr key={e.id}>
                    <td data-label="When">{fmt(e.at)}</td>
                    <td data-label="Resource">{e.resourceName}</td>
                    <td className="num" data-label="Units">
                      −{e.amount}
                    </td>
                  </tr>
                ))}
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
