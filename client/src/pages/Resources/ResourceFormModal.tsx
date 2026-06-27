import { useState, type FormEvent } from 'react';

import Modal from '../../components/Modal/Modal';
import { createResource, updateResource } from '../../api/resources';
import type { MembershipLevel, NewResource, Resource } from '../../types';

const TIERS: MembershipLevel[] = ['SILVER', 'GOLD', 'PLATINUM'];
const fieldLabel = 'flex flex-col gap-1.5 text-[0.8rem] text-[#9fb3d8]';
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

interface Props {
  // When provided, the modal edits that resource; otherwise it provisions a new one.
  resource?: Resource;
  onClose: () => void;
  onSaved: (resource: Resource) => void;
}

/** Create / edit a resource. Owns its own form state and the save request. */
export default function ResourceFormModal({ resource, onClose, onSaved }: Props) {
  const editing = Boolean(resource);
  const [form, setForm] = useState<NewResource>(
    resource
      ? { name: resource.name, minLevel: resource.minLevel, maxQty: resource.maxQty }
      : { name: '', minLevel: 'SILVER', maxQty: 1 },
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const saved = resource
        ? await updateResource(resource.id, form)
        : await createResource(form);
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={editing ? 'Edit resource' : 'New resource'} onClose={onClose}>
      <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
        {error && <p className="error m-0">⚠ {error}</p>}
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
              setForm((f) => ({ ...f, maxQty: Math.max(1, Number(e.target.value) || 1) }))
            }
            required
          />
        </label>
        <div className="mt-4 flex justify-end gap-2.5">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Saving…' : editing ? 'Save' : 'Add resource'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
