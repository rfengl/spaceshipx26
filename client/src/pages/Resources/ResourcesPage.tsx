import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import Modal from '../../components/Modal/Modal';
import ConfirmDialog from '../../components/Modal/ConfirmDialog';
import {
  listResources,
  createResource,
  updateResource,
  deleteResource,
} from '../../api/resources';
import type { MembershipLevel, NewResource, Resource } from '../../types';

const TIERS: MembershipLevel[] = ['SILVER', 'GOLD', 'PLATINUM'];
const emptyForm: NewResource = { name: '', minLevel: 'SILVER', maxQty: 1 };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

const fieldLabel = 'flex flex-col gap-1.5 text-[0.8rem] text-[#9fb3d8]';

export default function ResourcesPage() {
  const { user } = useAuth();
  const isCrew = user.role === 'CREW_LEAD';

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NewResource>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [deleting, setDeleting] = useState<Resource | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  async function toggleActive(resource: Resource) {
    setError(null);
    try {
      await updateResource(resource.id, { active: !resource.active });
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

  return (
    <>
      <Link to="/" className="back-link">
        ← Dashboard
      </Link>

      <section className="card">
        <div className="flex items-center justify-between gap-4 max-sm:mb-4">
          <h2 className="m-0 text-[1.1rem]">Resources</h2>
          {isCrew && (
            <button className="btn" onClick={openCreate}>
              + Add resource
            </button>
          )}
        </div>

        {!isCrew && (
          <p className="muted mt-3">
            Read-only — resource provisioning is restricted to Crew Leads.
          </p>
        )}

        {error && <p className="error mt-3">⚠ {error}</p>}

        {loading && resources.length === 0 ? (
          <p className="muted mt-3">Loading resources…</p>
        ) : resources.length === 0 ? (
          <p className="muted mt-3">No resources yet.</p>
        ) : (
          <table className="resource-table mt-3">
            <thead>
              <tr>
                <th>Name</th>
                <th>Min tier</th>
                <th className="num">Max qty</th>
                <th>Status</th>
                {isCrew && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.id} className={r.active ? '' : 'inactive'}>
                  <td data-label="Name">{r.name}</td>
                  <td data-label="Min tier">
                    <span className={`tier tier-${r.minLevel}`}>{r.minLevel}</span>
                  </td>
                  <td className="num" data-label="Max qty">
                    {r.maxQty}
                  </td>
                  <td data-label="Status">{r.active ? 'Active' : 'Decommissioned'}</td>
                  {isCrew && (
                    <td className="row-actions">
                      <button className="link-btn" onClick={() => openEdit(r)}>
                        Edit
                      </button>
                      <button className="link-btn" onClick={() => void toggleActive(r)}>
                        {r.active ? 'Decommission' : 'Recommission'}
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
              ))}
            </tbody>
          </table>
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

      {deleting && (
        <ConfirmDialog
          title="Delete resource"
          message={
            <>
              Delete <strong>{deleting.name}</strong>? This permanently removes it and
              cannot be undone.
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
