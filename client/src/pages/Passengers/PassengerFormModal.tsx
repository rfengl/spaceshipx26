import { useState, type FormEvent } from 'react';

import Modal from '../../components/Modal/Modal';
import PasswordInput from '../../components/PasswordInput';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import {
  createPassenger,
  updatePassenger,
  type PassengerChanges,
} from '../../api/passengers';
import type { MembershipLevel, NewPassenger, Passenger } from '../../types';

const TIERS: MembershipLevel[] = ['SILVER', 'GOLD', 'PLATINUM'];
const fieldLabel = 'flex flex-col gap-1.5 text-[0.8rem] text-[#9fb3d8]';

interface Props {
  // When provided the modal edits that passenger; otherwise it adds a new one.
  passenger?: Passenger;
  onClose: () => void;
  onSaved: (passenger: Passenger) => void;
}

/** Create / edit a passenger. Owns its own form state and the save request. */
export default function PassengerFormModal({ passenger, onClose, onSaved }: Props) {
  const editing = Boolean(passenger);
  const [form, setForm] = useState<NewPassenger>(
    passenger
      ? {
          username: passenger.username,
          password: '', // blank = keep current access code
          name: passenger.name,
          membershipLevel: passenger.membershipLevel,
        }
      : { username: '', password: '', name: '', membershipLevel: 'SILVER' },
  );
  const [confirmPassword, setConfirmPassword] = useState('');
  const { busy, error, run, setError } = useAsyncAction();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    const username = form.username.trim();
    if (!name || !username) {
      setError('Name and username are required.');
      return;
    }

    const changingPassword = form.password !== '';
    if (!editing && !changingPassword) {
      setError('An access code is required.');
      return;
    }
    if (changingPassword) {
      if (form.password.length < 4) {
        setError('Access code must be at least 4 characters.');
        return;
      }
      if (form.password !== confirmPassword) {
        setError('Access codes do not match.');
        return;
      }
    }

    await run(async () => {
      let saved: Passenger;
      if (passenger) {
        const changes: PassengerChanges = {
          name,
          username,
          membershipLevel: form.membershipLevel,
        };
        if (changingPassword) changes.password = form.password;
        saved = await updatePassenger(passenger.id, changes);
      } else {
        saved = await createPassenger({
          username,
          password: form.password,
          name,
          membershipLevel: form.membershipLevel,
        });
      }
      onSaved(saved);
      onClose();
    });
  }

  return (
    <Modal title={editing ? 'Edit passenger' : 'New passenger'} onClose={onClose}>
      <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
        <label className={fieldLabel}>
          Name
          <input
            type="text"
            className="input"
            value={form.name}
            placeholder="e.g. Nova Reyes"
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
            required
          />
        </label>

        <label className={fieldLabel}>
          Username
          <input
            type="text"
            className="input"
            value={form.username}
            placeholder="e.g. nova.reyes"
            autoComplete="username"
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            required
          />
        </label>

        <label className={fieldLabel}>
          {editing ? 'Access Code (leave blank to keep current)' : 'Access Code'}
          <PasswordInput
            value={form.password}
            onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            placeholder={editing ? '••••••••' : 'at least 4 characters'}
            required={!editing}
          />
        </label>

        <label className={fieldLabel}>
          Confirm Access Code
          <PasswordInput
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="re-enter access code"
            required={!editing}
          />
        </label>

        <label className={fieldLabel}>
          Membership tier
          <select
            className="input"
            value={form.membershipLevel}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                membershipLevel: e.target.value as MembershipLevel,
              }))
            }
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="error m-0 text-[0.85rem]">⚠ {error}</p>}

        <div className="mt-4 flex justify-end gap-2.5">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save' : 'Add passenger'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
