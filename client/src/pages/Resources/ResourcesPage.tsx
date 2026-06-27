import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import Modal from '../../components/Modal/Modal';
import ConfirmDialog from '../../components/Modal/ConfirmDialog';
import SearchInput from '../../components/SearchInput';
import Pagination from '../../components/Pagination';
import {
  listResources,
  createResource,
  updateResource,
  refillResource,
  deleteResource,
  getResourceDemand,
} from '../../api/resources';
import {
  TIER_RANK,
  type MembershipLevel,
  type NewResource,
  type Resource,
} from '../../types';

const TIERS: MembershipLevel[] = ['SILVER', 'GOLD', 'PLATINUM'];
const emptyForm: NewResource = { name: '', minLevel: 'SILVER', maxQty: 1 };
const PAGE_SIZE_OPTIONS = [5, 10, 20, 30, 50];

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

const fieldLabel = 'flex flex-col gap-1.5 text-[0.8rem] text-[#9fb3d8]';

// Colour cards by remaining stock so the worst shortages stand out.
function stockCard(remaining: number, max: number) {
  const ratio = max > 0 ? remaining / max : 0;
  if (ratio < 1 / 3) return 'border-[rgba(255,99,99,0.5)] bg-[rgba(255,80,80,0.12)]';
  if (ratio < 0.5) return 'border-[rgba(255,200,80,0.5)] bg-[rgba(255,200,80,0.11)]';
  return 'border-white/[0.08] bg-white/[0.04]';
}

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

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NewResource>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [refilling, setRefilling] = useState<Resource | null>(null);
  const [refillAmount, setRefillAmount] = useState(1);
  const [refillBusy, setRefillBusy] = useState(false);

  const [deleting, setDeleting] = useState<Resource | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = usePersistentState<SortKey>('resources.sortKey', 'name');
  const [sortDir, setSortDir] = usePersistentState<'asc' | 'desc'>(
    'resources.sortDir',
    'asc',
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentState('resources.pageSize', 10);
  const [demand, setDemand] = useState<Record<string, number>>({});

  // Usage counts per resource, for the "High demand" sort.
  useEffect(() => {
    getResourceDemand()
      .then(setDemand)
      .catch(() => setDemand({}));
  }, []);

  // Any change to the search, sort, or page size returns to the first page.
  useEffect(() => {
    setPage(1);
  }, [query, sortKey, sortDir, pageSize]);

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

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(resource: Resource) {
    setEditingId(resource.id);
    setForm({
      name: resource.name,
      minLevel: resource.minLevel,
      maxQty: resource.maxQty,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editingId) {
        await updateResource(editingId, form);
      } else {
        await createResource(form);
      }
      closeForm();
      await refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  }

  function openRefill(resource: Resource) {
    setRefilling(resource);
    setRefillAmount(1); // default to one unit; "Fill to max" link tops it up
    setError(null);
  }

  async function handleRefill(event: FormEvent) {
    event.preventDefault();
    if (!refilling) return;
    setRefillBusy(true);
    setError(null);
    try {
      await refillResource(refilling.id, refillAmount);
      setRefilling(null);
      await refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setRefillBusy(false);
    }
  }

  async function toggleDecommission(resource: Resource) {
    setError(null);
    try {
      await updateResource(resource.id, {
        isDecommissioned: !resource.isDecommissioned,
      });
      await refresh();
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
      setResources((prev) => prev.filter((r) => r.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  const room = refilling ? refilling.maxQty - refilling.remainingQty : 0;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? resources.filter(
        (r) => r.name.toLowerCase().includes(q) || r.minLevel.toLowerCase().includes(q),
      )
    : resources;

  const ratio = (r: Resource) => (r.maxQty > 0 ? r.remainingQty / r.maxQty : 0);

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
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
        return (ratio(a) - ratio(b)) * dir;
      default:
        return a.name.localeCompare(b.name) * dir;
    }
  });

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="back-link">
          ← Dashboard
        </Link>
        {isCrew && (
          <Link to="/audit-trail" className="back-link">
            Audit Trail →
          </Link>
        )}
      </div>

      <section className="card">
        <div className="flex items-center justify-between gap-4">
          <h2 className="m-0 text-[1.1rem]">Resources</h2>
          {isCrew && (
            <button className="btn" onClick={openCreate}>
              + Provision
            </button>
          )}
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
                      {paged.map((r) => {
                        const full = r.remainingQty >= r.maxQty;
                        const focused = r.id === focusId;
                        return (
                          <tr
                            key={r.id}
                            ref={focused ? setFocusRef : undefined}
                            className={focused ? 'bg-[rgba(90,208,255,0.1)]' : ''}
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
                              <td className="row-actions">
                                <button
                                  className="link-btn disabled:cursor-not-allowed disabled:opacity-40"
                                  disabled={r.isDecommissioned || full}
                                  title={full ? 'Already at maximum' : undefined}
                                  onClick={() => openRefill(r)}
                                >
                                  Refill
                                </button>
                                <button className="link-btn" onClick={() => openEdit(r)}>
                                  Edit
                                </button>
                                <button
                                  className={`link-btn ${
                                    r.isDecommissioned
                                      ? 'font-semibold text-[#8ef5b0]'
                                      : ''
                                  }`}
                                  onClick={() => void toggleDecommission(r)}
                                >
                                  {r.isDecommissioned ? 'Recommission' : 'Decommission'}
                                </button>
                                <button
                                  className="link-btn text-[#ff9d9d]"
                                  onClick={() => setDeleting(r)}
                                >
                                  Delete
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {paged.map((r) => {
                      const full = r.remainingQty >= r.maxQty;
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
                            <div className="row-actions mt-auto flex flex-wrap justify-end gap-x-3 gap-y-1 pt-2">
                              <button
                                className="link-btn disabled:cursor-not-allowed disabled:opacity-40"
                                disabled={r.isDecommissioned || full}
                                title={full ? 'Already at maximum' : undefined}
                                onClick={() => openRefill(r)}
                              >
                                Refill
                              </button>
                              <button className="link-btn" onClick={() => openEdit(r)}>
                                Edit
                              </button>
                              <button
                                className={`link-btn ${
                                  r.isDecommissioned ? 'font-semibold text-[#8ef5b0]' : ''
                                }`}
                                onClick={() => void toggleDecommission(r)}
                              >
                                {r.isDecommissioned ? 'Recommission' : 'Decommission'}
                              </button>
                              <button
                                className="link-btn text-[#ff9d9d]"
                                onClick={() => setDeleting(r)}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

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
          </>
        )}
      </section>

      {formOpen && (
        <Modal title={editingId ? 'Edit resource' : 'New resource'} onClose={closeForm}>
          <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
            <label className={fieldLabel}>
              Name
              <input
                type="text"
                className="input"
                value={form.name}
                placeholder="e.g. Hydroponics Bay"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
                required
              />
            </label>
            <label className={fieldLabel}>
              Minimum tier
              <select
                className="input"
                value={form.minLevel}
                onChange={(e) =>
                  setForm((f) => ({ ...f, minLevel: e.target.value as MembershipLevel }))
                }
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className={fieldLabel}>
              Max quantity
              <input
                type="number"
                className="input"
                min={1}
                value={form.maxQty}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    maxQty: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
                required
              />
            </label>
            <div className="mt-4 flex justify-end gap-2.5">
              <button type="button" className="btn-ghost" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={submitting}>
                {submitting ? 'Saving…' : editingId ? 'Save' : 'Add resource'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {refilling && (
        <Modal title={`Refill ${refilling.name}`} onClose={() => setRefilling(null)}>
          <form className="flex flex-col gap-3.5" onSubmit={handleRefill}>
            <p className="muted m-0 text-[0.85rem]">
              Currently <strong>{refilling.remainingQty}</strong> / {refilling.maxQty} in
              stock — you can add up to <strong>{room}</strong> more.
            </p>
            <label className={fieldLabel}>
              Refill amount
              <input
                type="number"
                className="input"
                min={1}
                max={room}
                value={refillAmount}
                onChange={(e) =>
                  setRefillAmount(
                    Math.min(room, Math.max(1, Number(e.target.value) || 1)),
                  )
                }
                autoFocus
                required
              />
            </label>
            <div className="mt-4 flex items-center justify-between gap-2.5">
              <button
                type="button"
                className="link-btn text-[0.82rem]"
                onClick={() => setRefillAmount(room)}
              >
                Fill to max ({room})
              </button>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setRefilling(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={refillBusy}>
                  {refillBusy ? 'Refilling…' : `Add ${refillAmount}`}
                </button>
              </div>
            </div>
          </form>
        </Modal>
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
