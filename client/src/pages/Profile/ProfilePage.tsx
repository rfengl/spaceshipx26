import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import Modal from '../../components/Modal/Modal';
import PasswordInput from '../../components/PasswordInput';
import { getMyProfile, updateMyProfile, type ProfileUpdate } from '../../api/profile';
import type { Passenger } from '../../types';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const fieldLabel = 'flex flex-col gap-1.5 text-[0.8rem] text-[#9fb3d8]';

export default function ProfilePage() {
  const { refreshUser } = useAuth();

  const [profile, setProfile] = useState<Passenger | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Re-authentication modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [currentCode, setCurrentCode] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyProfile()
      .then((p) => {
        setProfile(p);
        setName(p.name);
        setUsername(p.username);
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  // Validate the form, then prompt for the current access code.
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    if (!name.trim() || !username.trim()) {
      setError('Name and username are required.');
      return;
    }
    if (password !== '') {
      if (password.length < 4) {
        setError('Access code must be at least 4 characters.');
        return;
      }
      if (password !== confirm) {
        setError('Access codes do not match.');
        return;
      }
    }
    setError(null);
    setCurrentCode('');
    setModalError(null);
    setConfirmOpen(true);
  }

  async function doSave() {
    if (!currentCode) {
      setModalError('Enter your current access code.');
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      const update: ProfileUpdate = {
        name: name.trim(),
        username: username.trim(),
        currentPassword: currentCode,
      };
      if (password !== '') update.password = password;
      const updated = await updateMyProfile(update);
      setProfile(updated);
      setPassword('');
      setConfirm('');
      setCurrentCode('');
      setConfirmOpen(false);
      await refreshUser();
      setSaved(true);
    } catch (e) {
      setModalError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Link to="/" className="back-link">
        ← Dashboard
      </Link>

      <section className="card">
        <h2 className="m-0 text-[1.1rem]">Your profile</h2>

        {loading ? (
          <p className="muted mt-3">Loading profile…</p>
        ) : !profile ? (
          <p className="error mt-3">⚠ {error ?? 'Could not load your profile.'}</p>
        ) : (
          <form
            className="mt-4 flex max-w-[420px] flex-col gap-3.5"
            onSubmit={handleSubmit}
          >
            <label className={fieldLabel}>
              Name
              <input
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <label className={fieldLabel}>
              Username
              <input
                type="text"
                className="input"
                value={username}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>

            <label className={fieldLabel}>
              New Access Code (leave blank to keep current)
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
              />
            </label>

            <label className={fieldLabel}>
              Confirm New Access Code
              <PasswordInput
                value={confirm}
                onChange={setConfirm}
                placeholder="re-enter new access code"
              />
            </label>

            <label className={fieldLabel}>
              Membership tier
              <input
                type="text"
                className="input cursor-not-allowed opacity-60"
                value={profile.membershipLevel}
                disabled
              />
              <span className="text-[0.72rem] text-[#7f93b8]">
                Set by Crew Leads — you can’t change your own tier.
              </span>
            </label>

            {error && <p className="error m-0 text-[0.85rem]">⚠ {error}</p>}
            {saved && (
              <p className="m-0 text-[0.85rem] text-[#8ef5b0]">✓ Profile updated.</p>
            )}

            <div className="mt-2">
              <button type="submit" className="btn">
                Save changes
              </button>
            </div>
          </form>
        )}
      </section>

      {confirmOpen && (
        <Modal
          title="Confirm changes"
          onClose={() => {
            setConfirmOpen(false);
            setCurrentCode('');
            setModalError(null);
          }}
        >
          <form
            className="flex flex-col gap-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              void doSave();
            }}
          >
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

            {modalError && <p className="error m-0 text-[0.85rem]">⚠ {modalError}</p>}

            <div className="mt-2 flex justify-end gap-2.5">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setConfirmOpen(false);
                  setCurrentCode('');
                  setModalError(null);
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Saving…' : 'Confirm & save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
