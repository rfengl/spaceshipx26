import { useState, type FormEvent } from 'react';

import Modal from '../../components/Modal/Modal';
import { refillResource } from '../../api/resources';
import type { Resource } from '../../types';

const fieldLabel = 'flex flex-col gap-1.5 text-[0.8rem] text-[#9fb3d8]';
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

interface Props {
  resource: Resource;
  onClose: () => void;
  onApplied: (resource: Resource) => void;
}

/** Refill a resource up to its maximum. Owns its own amount + busy state. */
export default function RefillModal({ resource, onClose, onApplied }: Props) {
  const room = resource.maxQty - resource.remainingQty;
  const [amount, setAmount] = useState(1); // default one unit; "Fill to max" tops up
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onApplied(await refillResource(resource.id, amount));
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Refill ${resource.name}`} onClose={onClose}>
      <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
        {error && <p className="error m-0">⚠ {error}</p>}
        <p className="muted m-0 text-[0.85rem]">
          Currently <strong>{resource.remainingQty}</strong> / {resource.maxQty} in stock
          — you can add up to <strong>{room}</strong> more.
        </p>
        <label className={fieldLabel}>
          Refill amount
          <input
            type="number"
            className="input"
            min={1}
            max={room}
            value={amount}
            onChange={(e) =>
              setAmount(Math.min(room, Math.max(1, Number(e.target.value) || 1)))
            }
            autoFocus
            required
          />
        </label>
        <div className="mt-4 flex items-center justify-between gap-2.5">
          <button
            type="button"
            className="link-btn text-[0.82rem]"
            onClick={() => setAmount(room)}
          >
            Fill to max ({room})
          </button>
          <div className="flex gap-2.5">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Refilling…' : `Add ${amount}`}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
