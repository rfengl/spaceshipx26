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
import './ResourcesPage.css';

const TIERS: MembershipLevel[] = ['SILVER', 'GOLD', 'PLATINUM'];
const emptyForm: NewResource = { name: '', minLevel: 'SILVER', maxQty: 1 };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

export default function ResourcesPage() {
  const { user } = useAuth();
  const isCrew = user.role === 'CREW_LEAD';

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add/Edit modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NewResource>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation state
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
        <div className="resources-head">
          <h2>Resources</h2>
          {isCrew && <button onClick={openCreate}>+ Add resource</button>}
        </div>

        {!isCrew && (
          <p className="muted">
            Read-only — resource provisioning is restricted to Crew Leads.
          </p>
        )}

        {error && <p className="error">⚠ {error}</p>}

        {loading && resources.length === 0 ? (
          <p className="muted">Loading resources…</p>
        ) : resources.length === 0 ? (
          <p className="muted">No resources yet.</p>
        ) : (
          <table className="resource-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Min tier</th>
                <th>Max qty</th>
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
                  <td data-label="Max qty">{r.maxQty}</td>
                  <td data-label="Status">{r.active ? 'Active' : 'Decommissioned'}</td>
                  {isCrew && (
                    <td className="row-actions">
                      <button className="link" onClick={() => openEdit(r)}>
                        Edit
                      </button>
                      <button className="link" onClick={() => void toggleActive(r)}>
                        {r.active ? 'Decommission' : 'Recommission'}
                      </button>
                      <button className="link danger" onClick={() => setDeleting(r)}>
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
          <form className="modal-form" onSubmit={handleSubmit}>
            <label>
              Name
              <input
                type="text"
                value={form.name}
                placeholder="e.g. Hydroponics Bay"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
                required
              />
            </label>
            <label>
              Minimum tier
              <select
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
            <label>
              Max quantity
              <input
                type="number"
                min={1}
                value={form.maxQty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxQty: Math.max(1, Number(e.target.value) || 1) }))
                }
                required
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" disabled={submitting}>
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
