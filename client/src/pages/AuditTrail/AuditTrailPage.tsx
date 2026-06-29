import { useEffect, useState } from 'react';

import Pagination from '../../components/Pagination';
import { getAuditPage, type AuditAction, type AuditEntry } from '../../api/audit';
import { listResources } from '../../api/resources';
import { listCrewLeads } from '../../api/crewLeads';
import { listPassengers } from '../../api/passengers';
import { usePagination } from '../../hooks/usePagination';
import BackDashboardButton from '../../components/BackDashboardButton';
import { errorMessage } from '../../utils/errorMessage';

const fmt = (at: string) =>
  new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// Display label + badge colour per activity type.
const ACTION_META: Record<AuditAction, { label: string; cls: string }> = {
  USE: { label: 'Used', cls: 'bg-[rgba(90,208,255,0.18)] text-[#afe3ff]' },
  REFILL: { label: 'Refilled', cls: 'bg-[rgba(120,240,160,0.18)] text-[#8ef5b0]' },
  WRITE_OFF: { label: 'Written off', cls: 'bg-[rgba(255,140,80,0.2)] text-[#ffb27a]' },
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

// Quantity shown per activity: −N when stock leaves (use/write-off), +N for a
// refill, nothing for lifecycle actions.
const qtyLabel = (e: AuditEntry) => {
  if (e.type === 'USE' || e.type === 'WRITE_OFF') return `−${e.amount}`;
  if (e.type === 'REFILL') return `+${e.amount}`;
  return '—';
};

interface Option {
  value: string;
  label: string;
}

const byLabel = (a: Option, b: Option) => a.label.localeCompare(b.label);

export default function AuditTrailPage() {
  // The trail is unbounded, so it's paginated and filtered server-side: each
  // change refetches just the matching page plus a total count (for the pager).
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Server-side mode: no client array to slice, so `total` drives the page
  // count and the page below is fetched from the API.
  const paging = usePagination(null, {
    total,
    storageKey: 'audit.pageSize',
    resetKey: `${userId}-${resourceId}-${from}-${to}`,
  });

  // Filter dropdowns are sourced from the live rosters/inventory (active only),
  // so soft-deleted users/resources aren't selectable — their past activity
  // still appears under "All".
  const [userOptions, setUserOptions] = useState<Option[]>([]);
  const [resourceOptions, setResourceOptions] = useState<Option[]>([]);

  useEffect(() => {
    // Anyone who can act on resources (crew refills/lifecycle + passenger uses).
    Promise.all([listCrewLeads(), listPassengers()])
      .then(([crew, passengers]) => {
        const map = new Map<string, string>();
        [...crew, ...passengers].forEach((u) => map.set(u.id, u.name));
        setUserOptions(
          [...map].map(([value, label]) => ({ value, label })).sort(byLabel),
        );
      })
      .catch(() => setUserOptions([]));
  }, []);

  useEffect(() => {
    listResources()
      .then((rs) =>
        setResourceOptions(rs.map((r) => ({ value: r.id, label: r.name })).sort(byLabel)),
      )
      .catch(() => setResourceOptions([]));
  }, []);

  const { page, pageSize, onPage } = paging;
  // Refetch the current page whenever the page, page size, or any filter changes.
  // `active` guards against an out-of-order response overwriting a newer one.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getAuditPage({ page, pageSize, userId, resourceId, from, to })
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
  }, [page, pageSize, userId, resourceId, from, to]);

  const hasFilter = Boolean(userId || resourceId || from || to);

  // Changing a filter or the page size resets back to the first page.
  const onFilter =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setter(e.target.value);
      onPage(1);
    };
  const clear = () => {
    setUserId('');
    setResourceId('');
    setFrom('');
    setTo('');
    onPage(1);
  };

  const field =
    'flex min-w-0 flex-col gap-1 text-[0.72rem] uppercase tracking-[0.06em] text-[#7f93b8]';

  return (
    <>
      <BackDashboardButton />

      <section className="card">
        <h2 className="m-0 text-[1.1rem]">Audit trail</h2>
        <p className="muted mt-1 text-[0.9rem]">
          Every resource activity — passenger usage, crew refills, and lifecycle changes
          (provision, decommission, recommission, delete).
        </p>

        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className={field}>
            User
            <select
              className="input w-full py-[0.4rem]"
              value={userId}
              onChange={onFilter(setUserId)}
            >
              <option value="">All</option>
              {userOptions.map((o) => (
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
              onChange={onFilter(setResourceId)}
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
              onChange={onFilter(setFrom)}
            />
          </label>
          <label className={field}>
            To
            <input
              type="date"
              className="input w-full py-[0.4rem]"
              value={to}
              min={from || undefined}
              onChange={onFilter(setTo)}
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

        {loading && entries.length === 0 ? (
          <p className="muted mt-4">Loading activity…</p>
        ) : entries.length === 0 ? (
          <p className="muted mt-4">
            {hasFilter
              ? 'No activity matches these filters.'
              : 'No activity recorded yet.'}
          </p>
        ) : (
          <>
            <table className="data-table mt-4">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Activity</th>
                  <th>Resource</th>
                  <th>User</th>
                  <th className="num">Qty</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
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
                      <td data-label="Resource">
                        {e.resourceName}
                        {e.note && <span className="text-[#7f93b8]"> · {e.note}</span>}
                      </td>
                      <td data-label="User">
                        {e.userName}{' '}
                        <span className={`tier tier-${e.userLevel} ml-1 text-[0.62rem]`}>
                          {e.userLevel}
                        </span>
                      </td>
                      <td className="num" data-label="Qty">
                        {qtyLabel(e)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <Pagination {...paging} />
          </>
        )}
      </section>
    </>
  );
}
