import { useState, type FormEvent } from 'react';

import { login } from '../../api/auth';
import type { AuthUser } from '../../types';

interface Props {
  onAuthenticated: (user: AuthUser) => void;
}

// Seeded accounts, shown as one-click hints (all share the demo password).
const DEMO_PASSWORD = 'mars2026';
const DEMO_LOGINS: { role: string; username: string }[] = [
  { role: 'Crew Lead', username: 'ada.lovelace' },
  { role: 'Silver', username: 'nova.reyes' },
  { role: 'Gold', username: 'priya.anand' },
  { role: 'Platinum', username: 'lena.park' },
];

const inputClass =
  'rounded-[10px] border border-[rgba(120,160,220,0.25)] bg-[rgba(6,10,22,0.85)] px-[0.85rem] py-[0.7rem] text-base normal-case tracking-normal text-[#e8eefc] transition focus:border-[#5ad0ff] focus:outline-none focus:shadow-[0_0_0_3px_rgba(90,208,255,0.18)]';

export default function LoginPage({ onAuthenticated }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function applyHint(name: string) {
    setUsername(name);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your callsign and access code to proceed.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(username.trim(), password);
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-8 bg-[radial-gradient(120%_80%_at_50%_-10%,#243049_0%,#0c1018_55%,#05070d_100%)]">
      <div className="grid w-[min(760px,100%)] grid-cols-1 items-center gap-6 rounded-[22px] border border-[rgba(140,170,220,0.18)] bg-[linear-gradient(160deg,rgba(40,52,76,0.65),rgba(12,16,26,0.85))] px-8 py-7 shadow-[0_30px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md md:grid-cols-[240px_1fr] md:gap-10">
        {/* The window: looking out into the universe (bespoke art classes) */}
        <div className="porthole">
          <div className="space">
            <div className="stars stars-far" />
            <div className="stars stars-mid" />
            <div className="stars stars-near" />
            <div className="nebula" />
            <div className="planet" />
            <div className="shooting-star" />

            <div className="ship">
              <svg viewBox="0 0 240 90" width="150" aria-hidden="true">
                <defs>
                  <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#eef4ff" />
                    <stop offset="0.5" stopColor="#aebfdd" />
                    <stop offset="1" stopColor="#5a6a8c" />
                  </linearGradient>
                  <radialGradient id="flame" cx="0.2" cy="0.5" r="0.8">
                    <stop offset="0" stopColor="#fff7d6" />
                    <stop offset="0.4" stopColor="#ffb347" />
                    <stop offset="1" stopColor="rgba(255,80,40,0)" />
                  </radialGradient>
                </defs>
                <ellipse
                  className="thrust"
                  cx="36"
                  cy="45"
                  rx="40"
                  ry="11"
                  fill="url(#flame)"
                />
                <path
                  d="M60 45 C90 18 160 12 214 30 C226 34 232 40 232 45 C232 50 226 56 214 60 C160 78 90 72 60 45 Z"
                  fill="url(#hull)"
                />
                <path d="M96 36 L120 8 L132 34 Z" fill="#6f7fa6" />
                <path d="M96 54 L120 82 L132 56 Z" fill="#55648a" />
                <ellipse cx="186" cy="45" rx="16" ry="11" fill="#7fe9ff" opacity="0.95" />
                <ellipse
                  cx="186"
                  cy="45"
                  rx="16"
                  ry="11"
                  fill="none"
                  stroke="#dff7ff"
                  strokeWidth="2"
                />
                <circle cx="120" cy="45" r="3.2" fill="#ffd86b" />
                <circle cx="138" cy="45" r="3.2" fill="#ffd86b" />
                <circle cx="156" cy="45" r="3.2" fill="#ffd86b" />
              </svg>
            </div>

            <div className="glass-glare" />
          </div>

          <div className="frame" />
          <span className="bolt b1" />
          <span className="bolt b2" />
          <span className="bolt b3" />
          <span className="bolt b4" />
          <span className="bolt b5" />
          <span className="bolt b6" />
          <span className="bolt b7" />
          <span className="bolt b8" />
        </div>

        {/* The console: login controls (Tailwind utilities) */}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="mb-1 flex items-center gap-3.5">
            <span className="text-[2.2rem] drop-shadow-[0_0_10px_rgba(90,200,255,0.6)]">
              🚀
            </span>
            <div>
              <h1 className="m-0 bg-[linear-gradient(90deg,#eaf4ff,#7fd0ff)] bg-clip-text text-[1.7rem] tracking-[0.02em] text-transparent">
                Spaceship X26
              </h1>
              <p className="mb-0 mt-0.5 text-[0.78rem] uppercase tracking-[0.18em] text-[#7f93b8]">
                Pilot Authentication
              </p>
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-[0.78rem] uppercase tracking-[0.12em] text-[#9fb3d8]">
            PILOT
            <input
              type="text"
              className={inputClass}
              value={username}
              autoComplete="username"
              placeholder="e.g. ada.lovelace"
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[0.78rem] uppercase tracking-[0.12em] text-[#9fb3d8]">
            Access Code
            <input
              type="password"
              className={inputClass}
              value={password}
              autoComplete="current-password"
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <p className="m-0 text-[0.9rem] text-[#ff9d9d]">⚠ {error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1.5 cursor-pointer rounded-[10px] border-0 bg-[linear-gradient(90deg,#5ad0ff,#6a8cff)] px-[1.1rem] py-[0.85rem] text-base font-semibold tracking-[0.06em] text-[#06121f] shadow-[0_8px_24px_rgba(90,150,255,0.4)] transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Authenticating…' : 'Initiate Launch Sequence'}
          </button>

          <div className="mt-1.5 flex flex-col gap-2">
            <span className="text-[0.7rem] uppercase tracking-[0.14em] text-[#66789c]">
              Demo logins · password {DEMO_PASSWORD}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {DEMO_LOGINS.map((demo) => (
                <button
                  type="button"
                  key={demo.username}
                  onClick={() => applyHint(demo.username)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[rgba(120,160,220,0.25)] bg-[rgba(90,208,255,0.06)] px-[0.6rem] py-[0.35rem] text-[0.78rem] text-[#cdddf6] transition hover:border-[#5ad0ff] hover:bg-[rgba(90,208,255,0.14)]"
                >
                  <strong className="text-[0.66rem] uppercase tracking-[0.06em] text-[#7fd0ff]">
                    {demo.role}
                  </strong>
                  {demo.username}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
