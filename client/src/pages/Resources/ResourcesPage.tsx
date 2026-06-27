import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import Modal from '../../components/Modal/Modal';
import ConfirmDialog from '../../components/Modal/ConfirmDialog';
import SearchInput from '../../components/SearchInput';
import {
  listResources,
  createResource,
  updateResource,
  refillResource,
  deleteResource,
} from '../../api/resources';
import type { MembershipLevel, NewResource, Resource } from '../../types';

const TIERS: MembershipLevel[] = ['SILVER', 'GOLD', 'PLATINUM'];
const emptyForm: NewResource = { name: '', minLevel: 'SILVER', maxQty: 1 };

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
  const focusRef = useRef<HTMLDivElement | null>(null);

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
    setRefillAmount(resource.maxQty - resource.remainingQty); // default: fill to max
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

  return (
    <>
      <Link to="/" className="back-link">
        ← Dashboard
      </Link>

      <section className="card">
        <div className="flex items-center justify-between gap-4">
          <h2 className="m-0 text-[1.1rem]">Resources</h2>
          {isCrew && (
            <button className="btn" onClick={openCreate}>
              + Add resource
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
            <div className="mt-3">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search by name or tier…"
              />
            </div>

            {filtered.length === 0 ? (
              <p className="muted mt-3">No resources match “{query}”.</p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((r) => {
                  const full = r.remainingQty >= r.maxQty;
                  const focused = r.id === focusId;
                  return (
                    <div
                      key={r.id}
                      ref={focused ? focusRef : undefined}
                      className={`flex flex-col gap-2 rounded-xl border p-5 transition ${stockCard(
                        r.remainingQty,
                        r.maxQty,
                      )} ${focused ? 'ring-2 ring-[#5ad0ff]' : ''} ${
                        r.isDecommissioned ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="m-0 text-[1.05rem]">{r.name}</h3>
                        <span className={`tier tier-${r.minLevel}`}>{r.minLevel}</span>
                      </div>
                      <p className="m-0 text-[0.9rem] text-[#9fb3d8]">
                        <strong className="text-[1.05rem] text-[#e8eefc]">
                          {r.remainingQty}
                        </strong>{' '}
                        / {r.maxQty} in stock
                      </p>
                      <p className="m-0 text-[0.8rem] text-[#9fb3d8]">
                        {r.isDecommissioned ? 'Decommissioned' : 'Active'}
                      </p>

                      {isCrew && (
                        <div className="row-actions mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-2">
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
                            className="link-btn"
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
            <div className="mt-4 flex justify-end gap-2.5">
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
