import { useEffect, useState } from 'react';

import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import { getMyHistory, type AuditEntry } from '../../api/audit';
import { listMyResources } from '../../api/resources';
import type { Resource } from '../../types';
import BackDashboardButton from '../../components/BackDashboardButton';
import { errorMessage } from '../../utils/errorMessage';
import { formatDateTime } from '../../utils/dateUtil';

export default function PersonalHistoryPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [resourceId, setResourceId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Server-driven paging: this page fetches its own slice (items = null).
  const { page, pageCount, pageSize, onPage, onPageSize } = usePagination<AuditEntry>(
    null,
    { storageKey: 'history.pageSize', total, resetKey: `${resourceId}|${from}|${to}` },
  );

  // Resources the passenger can reach — drives the filter dropdown.
  useEffect(() => {
    listMyResources()
      .then(setResources)
      .catch(() => {});
  }, []);

  // Fetch the current page server-side whenever paging or filters change.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getMyHistory({
      page,
      pageSize,
      resourceId: resourceId || undefined,
      from: from || undefined,
      to: to || undefined,
    })
      .then((res) => {
        if (!active) return;
        setEntries(res.data);
        setTotal(res.total);
      })
      .catch((e) => active && setError(errorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page, pageSize, resourceId, from, to]);

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
      <BackDashboardButton />

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
              {resources.map((r) => (
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

        {!loading && total > 0 && (
          <p className="muted mt-3 text-[0.85rem]">
            <strong className="text-[#bcd4ff]">{total}</strong> use
            {total === 1 ? '' : 's'}
            {hasFilter ? ' match these filters' : ' recorded'}.
          </p>
        )}

        {error && <p className="error mt-3">⚠ {error}</p>}

        {loading && entries.length === 0 ? (
          <p className="muted mt-4">Loading history…</p>
        ) : total === 0 ? (
          <p className="muted mt-4">
            {hasFilter
              ? 'No activity matches these filters.'
              : 'You have not used any resources yet.'}
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
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td data-label="When">{formatDateTime(e.at)}</td>
                    <td data-label="Resource">{e.resourceName}</td>
                    <td className="num" data-label="Units">
                      −{e.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              onPage={onPage}
              onPageSize={onPageSize}
            />
          </>
        )}
      </section>
    </>
  );
}
