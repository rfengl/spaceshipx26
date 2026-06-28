import { useState, type FormEvent } from 'react';

import Modal from '../../components/Modal/Modal';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { proposeSwap } from '../../api/crewLeads';
import type { Passenger } from '../../types';

const fieldLabel = 'flex flex-col gap-1.5 text-[0.8rem] text-[#9fb3d8]';

interface Props {
  demotable: Passenger[]; // crew leads who can be demoted (excludes self)
  passengers: Passenger[]; // candidates to promote
  onProposed: () => void; // refresh the pending-requests list
}

/**
 * The "Propose swap" button — self-contained: owns the modal and its selection
 * state. The candidate lists come from the page; on success it asks the page to
 * refresh the pending requests.
 */
export default function ProposeSwapButton({ demotable, passengers, onProposed }: Props) {
  const [open, setOpen] = useState(false);
  const [demoteId, setDemoteId] = useState('');
  const [promoteId, setPromoteId] = useState('');
  const { busy, error, run, setError } = useAsyncAction();

  function openModal() {
    setDemoteId('');
    setPromoteId('');
    setError(null);
    setOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!demoteId || !promoteId) return;
    await run(async () => {
      await proposeSwap(demoteId, promoteId);
      setOpen(false);
      onProposed();
    });
  }

  return (
    <>
      <button className="btn" onClick={openModal}>
        Propose swap
      </button>

      {open && (
        <Modal title="Propose a crew-lead swap" onClose={() => setOpen(false)}>
          <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
            <label className={fieldLabel}>
              Demote (crew lead → passenger)
              <select
                className="input"
                value={demoteId}
                onChange={(e) => setDemoteId(e.target.value)}
                required
              >
                <option value="">Select a crew lead…</option>
                {demotable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (@{c.username})
                  </option>
                ))}
              </select>
            </label>
            <label className={fieldLabel}>
              Promote (passenger → crew lead)
              <select
                className="input"
                value={promoteId}
                onChange={(e) => setPromoteId(e.target.value)}
                required
              >
                <option value="">Select a passenger…</option>
                {passengers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (@{p.username})
                  </option>
                ))}
              </select>
            </label>
            <p className="muted m-0 text-[0.8rem]">
              The swap only applies once another crew lead approves it.
            </p>
            {error && <p className="error m-0 text-[0.85rem]">⚠ {error}</p>}
            <div className="mt-2 flex justify-end gap-2.5">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? 'Submitting…' : 'Propose swap'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
