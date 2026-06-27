import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import PasswordInput from '../../components/PasswordInput';
import ReauthConfirmModal from './ReauthConfirmModal';
import { getMyProfile, updateMyProfile, type ProfileUpdate } from '../../api/profile';
import type { Passenger } from '../../types';
import BackDashboardButton from '../../components/BackDashboardButton';

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

  // Re-authentication modal (the modal owns the code input + busy/error state).
  const [confirmOpen, setConfirmOpen] = useState(false);

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
    setConfirmOpen(true);
  }

  // Runs after the modal collects the current access code; throws on failure so
  // the modal can show the error and stay open.
  async function save(currentPassword: string) {
    const update: ProfileUpdate = {
      name: name.trim(),
      username: username.trim(),
      currentPassword,
    };
    if (password !== '') update.password = password;
    const updated = await updateMyProfile(update);
    setProfile(updated);
    setPassword('');
    setConfirm('');
    await refreshUser();
    setSaved(true);
  }

  return (
    <>
      <BackDashboardButton />

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
        <ReauthConfirmModal onConfirm={save} onClose={() => setConfirmOpen(false)} />
      )}
    </>
  );
}
