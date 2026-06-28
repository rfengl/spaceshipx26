import { useState, type FormEvent } from 'react';

import Modal from '../../components/Modal/Modal';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { writeOffResource } from '../../api/resources';
import type { Resource } from '../../types';

const REASONS = ['Expired', 'Broken', 'Lost', 'Other'];
const fieldLabel = 'flex flex-col gap-1.5 text-[0.8rem] text-[#9fb3d8]';

interface Props {
  resource: Resource;
  onClose: () => void;
  onApplied: (resource: Resource) => void;
}

/** Write off stock that can no longer be consumed. Owns amount + reason state. */
export default function WriteOffModal({ resource, onClose, onApplied }: Props) {
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState(REASONS[0]);
  const { busy, error, run } = useAsyncAction();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      onApplied(await writeOffResource(resource.id, amount, reason));
      onClose();
    });
  }

  return (
    <Modal title={`Write off ${resource.name}`} onClose={onClose}>
      <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
        {error && <p className="error m-0">⚠ {error}</p>}
        <p className="muted m-0 text-[0.85rem]">
          Remove stock that can no longer be consumed. Currently{' '}
          <strong>{resource.remainingQty}</strong> / {resource.maxQty} in stock.
        </p>
        <label className={fieldLabel}>
          Amount to write off
          <input
            type="number"
            className="input"
            min={1}
            max={resource.remainingQty}
            value={amount}
            onChange={(e) =>
              setAmount(
                Math.min(resource.remainingQty, Math.max(1, Number(e.target.value) || 1)),
              )
            }
            autoFocus
            required
          />
        </label>
        <label className={fieldLabel}>
          Reason
          <select
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 flex justify-end gap-2.5">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-danger" disabled={busy}>
            {busy ? 'Writing off…' : `Write off ${amount}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
