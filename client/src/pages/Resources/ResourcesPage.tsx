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
import ResourceTable from './ResourceTable';
import ResourceCards from './ResourceCards';
import { type ResourceActionHandlers } from './ResourceActions';
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
import type { Resource } from '../../types';
import BackDashboardButton from '../../components/BackDashboardButton';
import { errorMessage } from '../../utils/errorMessage';
import { sortResources, type SortKey } from './sortResources';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'minLevel', label: 'Tier' },
  { value: 'remainingQty', label: 'Stock' },
  { value: 'status', label: 'Status' },
  { value: 'highDemand', label: 'High demand' },
  { value: 'shortages', label: 'Shortages' },
];

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
      setError(errorMessage(e));
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
      setError(errorMessage(e));
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
      setError(errorMessage(e));
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

  const sorted = useMemo(
    () => sortResources(filtered, sortKey, sortDir, demand),
    [filtered, sortKey, sortDir, demand],
  );

  const { pageItems, ...paging } = usePagination(sorted, {
    storageKey: 'resources.pageSize',
    resetKey: `${query}|${sortKey}|${sortDir}`,
  });

  // Crew action handlers, shared by the table and card views.
  const actions: ResourceActionHandlers = {
    onRefill: setRefilling,
    onWriteOff: setWritingOff,
    onEdit: setEditing,
    onToggleDecommission: (r) => void toggleDecommission(r),
    onDelete: setDeleting,
  };

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
                  <ResourceTable
                    items={pageItems}
                    isCrew={isCrew}
                    focusId={focusId}
                    setFocusRef={setFocusRef}
                    {...actions}
                  />
                ) : (
                  <ResourceCards
                    items={pageItems}
                    isCrew={isCrew}
                    focusId={focusId}
                    setFocusRef={setFocusRef}
                    {...actions}
                  />
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
