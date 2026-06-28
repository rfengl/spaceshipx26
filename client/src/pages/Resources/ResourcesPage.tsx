import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { usePersistentState } from '../../hooks/usePersistentState';
import { usePagination } from '../../hooks/usePagination';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useResourceSocket } from '../../hooks/useResourceSocket';
import { sameResource } from '../../utils/sameResource';
import ConfirmDialog from '../../components/Modal/ConfirmDialog';
import SearchInput from '../../components/SearchInput';
import Pagination from '../../components/Pagination';
import ResourceActions from './ResourceActions';
import ProvisionResourceButton from './ProvisionResourceButton';
import ResourceFormModal from './ResourceFormModal';
import RefillModal from './RefillModal';
import WriteOffModal from './WriteOffModal';
import {
  listResources,
  updateResource,
  deleteResource,
  getResourceDemand,
} from '../../api/resources';
import { TIER_RANK, type Resource } from '../../types';
import BackDashboardButton from '../../components/BackDashboardButton';

type SortKey =
  | 'name'
  | 'minLevel'
  | 'remainingQty'
  | 'status'
  | 'highDemand'
  | 'shortages';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'minLevel', label: 'Tier' },
  { value: 'remainingQty', label: 'Stock' },
  { value: 'status', label: 'Status' },
  { value: 'highDemand', label: 'High demand' },
  { value: 'shortages', label: 'Shortages' },
];

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

// Colour cards by remaining stock so the worst shortages stand out.
function stockCard(remaining: number, max: number) {
  const ratio = max > 0 ? remaining / max : 0;
  if (ratio < 1 / 3) return 'border-[rgba(255,99,99,0.5)] bg-[rgba(255,80,80,0.12)]';
  if (ratio < 0.5) return 'border-[rgba(255,200,80,0.5)] bg-[rgba(255,200,80,0.11)]';
  return 'border-white/[0.08] bg-white/[0.04]';
}

// Shortage hint as a cell background (matching the card view). Set on the cells
// rather than the <tr> because a row background paints unreliably under
// border-collapse.
function stockRowBg(remaining: number, max: number) {
  const ratio = max > 0 ? remaining / max : 0;
  if (ratio < 1 / 3) return '[&>td]:bg-[rgba(255,80,80,0.12)]';
  if (ratio < 0.5) return '[&>td]:bg-[rgba(255,200,80,0.1)]';
  return '';
}

// The focused row (arrived-at from a dashboard shortage card) gets a coloured
// left-edge border, kept separate from the shortage background so both show.
const FOCUS_ACCENT =
  '[&>td:first-child]:border-l-[3px] [&>td:first-child]:border-l-[#5ad0ff]';

// Remaining-stock ratio (module-level so it stays stable for the sort memo).
const stockRatio = (r: Resource) => (r.maxQty > 0 ? r.remainingQty / r.maxQty : 0);

export default function ResourcesPage() {
  const { user } = useAuth();
  const isCrew = user.role === 'CREW_LEAD';

  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus');
  // The focused resource can be a card (xs/sm) or a table row (md+), so the ref
  // is a generic element set via callback on whichever view is rendered.
  const focusRef = useRef<HTMLElement | null>(null);
  const setFocusRef = (el: HTMLElement | null) => {
    focusRef.current = el;
  };

  // Table on md and above; card grid on xs / sm.
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Each modal is opened by selecting the resource it acts on (null = closed).
  const [editing, setEditing] = useState<Resource | null>(null);
  const [refilling, setRefilling] = useState<Resource | null>(null);
  const [writingOff, setWritingOff] = useState<Resource | null>(null);

  const [deleting, setDeleting] = useState<Resource | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = usePersistentState<SortKey>('resources.sortKey', 'name');
  const [sortDir, setSortDir] = usePersistentState<'asc' | 'desc'>(
    'resources.sortDir',
    'asc',
  );
  const [demand, setDemand] = useState<Record<string, number>>({});

  // Usage counts per resource, for the "High demand" sort.
  useEffect(() => {
    getResourceDemand()
      .then(setDemand)
      .catch(() => setDemand({}));
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setResources(await listResources());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // Scroll the resource arrived-at from a dashboard shortage card into view.
  useEffect(() => {
    if (focusId && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusId, resources]);

  // Patch a single resource in place (add if new). Used by both our own
  // mutations and live socket pushes, so the list is never fully refetched.
  // Returning the previous array when nothing changed lets React skip the
  // re-render (e.g. a socket echo of a change we just applied optimistically).
  const applyResource = (r: Resource) =>
    setResources((prev) => {
      const current = prev.find((x) => x.id === r.id);
      if (current && sameResource(current, r)) return prev;
      return current ? prev.map((x) => (x.id === r.id ? r : x)) : [r, ...prev];
    });
  const removeResourceById = (id: string) =>
    setResources((prev) =>
      prev.some((x) => x.id === id) ? prev.filter((x) => x.id !== id) : prev,
    );

  // Live updates: another crew lead's change, or a passenger consuming stock.
  // (At this scale a full-list re-render per update is fine; if the inventory
  // grew large + chatty, the next step would be a React.memo'd row with
  // useCallback-stabilised handlers so only the changed row re-renders.)
  useResourceSocket((change) => {
    if (change.type === 'resource.updated') applyResource(change.resource);
    else removeResourceById(change.resourceId);
  });

  async function toggleDecommission(resource: Resource) {
    setError(null);
    try {
      applyResource(
        await updateResource(resource.id, {
          isDecommissioned: !resource.isDecommissioned,
        }),
      );
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await deleteResource(deleting.id);
      removeResourceById(deleting.id);
      setDeleting(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter(
      (r) => r.name.toLowerCase().includes(q) || r.minLevel.toLowerCase().includes(q),
    );
  }, [resources, query]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'minLevel':
          return (TIER_RANK[a.minLevel] - TIER_RANK[b.minLevel]) * dir;
        case 'remainingQty':
          return (a.remainingQty - b.remainingQty) * dir;
        case 'status':
          // In-service first when ascending.
          return (Number(a.isDecommissioned) - Number(b.isDecommissioned)) * dir;
        case 'highDemand':
          // Most-used first when ascending.
          return ((demand[b.id] ?? 0) - (demand[a.id] ?? 0)) * dir;
        case 'shortages':
          // Most-depleted (lowest stock ratio) first when ascending.
          return (stockRatio(a) - stockRatio(b)) * dir;
        default:
          return a.name.localeCompare(b.name) * dir;
      }
    });
  }, [filtered, sortKey, sortDir, demand]);

  const { pageItems, ...paging } = usePagination(sorted, {
    storageKey: 'resources.pageSize',
    resetKey: `${query}|${sortKey}|${sortDir}`,
  });

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <BackDashboardButton />
        {isCrew && (
          <Link to="/audit-trail" className="back-link">
            Audit Trail →
          </Link>
        )}
      </div>

      <section className="card">
        <div className="flex items-center justify-between gap-4">
          <h2 className="m-0 text-[1.1rem]">Resources</h2>
          {isCrew && <ProvisionResourceButton onCreated={applyResource} />}
        </div>

        {error && <p className="error mt-3">⚠ {error}</p>}

        {loading && resources.length === 0 ? (
          <p className="muted mt-3">Loading resources…</p>
        ) : resources.length === 0 ? (
          <p className="muted mt-3">No resources yet.</p>
        ) : (
          <>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search by name or tier…"
              />
              <div className="flex items-center gap-2 self-end sm:ml-auto sm:self-auto">
                <label className="muted text-[0.8rem]" htmlFor="resource-sort">
                  Sort
                </label>
                <select
                  id="resource-sort"
                  className="input py-[0.4rem]"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-ghost px-2.5 py-[0.4rem]"
                  aria-label={`Sort ${sortDir === 'asc' ? 'ascending' : 'descending'}`}
                  title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                >
                  {sortDir === 'asc' ? '▲' : '▼'}
                </button>
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="muted mt-3">No resources match “{query}”.</p>
            ) : (
              <>
                {isDesktop ? (
                  <table className="data-table mt-4">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Min tier</th>
                        <th className="num">Stock</th>
                        <th>Status</th>
                        {isCrew && <th aria-label="Actions" />}
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((r) => {
                        const focused = r.id === focusId;
                        return (
                          <tr
                            key={r.id}
                            ref={focused ? setFocusRef : undefined}
                            className={`${focused ? FOCUS_ACCENT : ''} ${stockRowBg(
                              r.remainingQty,
                              r.maxQty,
                            )}`}
                          >
                            <td data-label="Name">{r.name}</td>
                            <td data-label="Min tier">
                              <span className={`tier tier-${r.minLevel}`}>
                                {r.minLevel}
                              </span>
                            </td>
                            <td className="num" data-label="Stock">
                              {r.remainingQty} / {r.maxQty}
                            </td>
                            <td data-label="Status">
                              {r.isDecommissioned ? 'Decommissioned' : 'Active'}
                            </td>
                            {isCrew && (
                              <td data-label="Actions">
                                <ResourceActions
                                  resource={r}
                                  onRefill={setRefilling}
                                  onWriteOff={setWritingOff}
                                  onEdit={setEditing}
                                  onToggleDecommission={(x) => void toggleDecommission(x)}
                                  onDelete={setDeleting}
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {pageItems.map((r) => {
                      const focused = r.id === focusId;
                      return (
                        <div
                          key={r.id}
                          ref={focused ? setFocusRef : undefined}
                          className={`flex flex-col gap-2 rounded-xl border p-5 transition ${stockCard(
                            r.remainingQty,
                            r.maxQty,
                          )} ${focused ? 'ring-2 ring-[#5ad0ff]' : ''}`}
                        >
                          {/* Dim only the info when decommissioned — the action
                            buttons (esp. Recommission) stay fully clickable. */}
                          <div
                            className={`flex flex-col gap-2 ${
                              r.isDecommissioned ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="m-0 text-[1.05rem]">{r.name}</h3>
                              <span className={`tier tier-${r.minLevel}`}>
                                {r.minLevel}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="m-0 text-[0.9rem] text-[#9fb3d8]">
                                <strong className="text-[1.05rem] text-[#e8eefc]">
                                  {r.remainingQty}
                                </strong>{' '}
                                / {r.maxQty} in stock
                              </p>
                              <span className="text-[0.8rem] text-[#9fb3d8]">
                                {r.isDecommissioned ? 'Decommissioned' : 'Active'}
                              </span>
                            </div>
                          </div>

                          {isCrew && (
                            <ResourceActions
                              resource={r}
                              className="mt-auto pt-2"
                              onRefill={setRefilling}
                              onWriteOff={setWritingOff}
                              onEdit={setEditing}
                              onToggleDecommission={(x) => void toggleDecommission(x)}
                              onDelete={setDeleting}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <Pagination {...paging} />
              </>
            )}
          </>
        )}
      </section>

      {editing && (
        <ResourceFormModal
          resource={editing}
          onClose={() => setEditing(null)}
          onSaved={applyResource}
        />
      )}

      {refilling && (
        <RefillModal
          resource={refilling}
          onClose={() => setRefilling(null)}
          onApplied={applyResource}
        />
      )}

      {writingOff && (
        <WriteOffModal
          resource={writingOff}
          onClose={() => setWritingOff(null)}
          onApplied={applyResource}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete resource"
          message={
            <>
              Delete <strong>{deleting.name}</strong>? It will be removed from inventory.
              Its record and history are retained.
            </>
          }
          confirmLabel="Delete"
          danger
          busy={deleteBusy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
