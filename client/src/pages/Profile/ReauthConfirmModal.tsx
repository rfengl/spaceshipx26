import { useState, type FormEvent } from 'react';

import Modal from '../../components/Modal/Modal';
import PasswordInput from '../../components/PasswordInput';
import { useAsyncAction } from '../../hooks/useAsyncAction';

const fieldLabel = 'flex flex-col gap-1.5 text-[0.8rem] text-[#9fb3d8]';

interface Props {
  // Performs the protected action with the entered code; throws to surface an error.
  onConfirm: (currentPassword: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Re-authentication prompt: confirms the current access code before a sensitive
 * change. Owns the code input, busy, and error state; the action itself is
 * supplied by the caller.
 */
export default function ReauthConfirmModal({ onConfirm, onClose }: Props) {
  const [currentCode, setCurrentCode] = useState('');
  const { busy, error, run, setError } = useAsyncAction();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!currentCode) {
      setError('Enter your current access code.');
      return;
    }
    await run(async () => {
      await onConfirm(currentCode);
      onClose();
    });
  }

  return (
    <Modal title="Confirm changes" onClose={onClose}>
      <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
        <p className="muted m-0 text-[0.85rem]">
          Enter your <strong>current</strong> access code to save these changes.
        </p>
        <label className={fieldLabel}>
          Current Access Code
          <PasswordInput
            value={currentCode}
            onChange={setCurrentCode}
            placeholder="current access code"
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="error m-0 text-[0.85rem]">⚠ {error}</p>}

        <div className="mt-2 flex justify-end gap-2.5">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Saving…' : 'Confirm & save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
