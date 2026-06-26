import { useState, type FormEvent } from 'react';

import { login } from '../../api/auth';
import type { AuthUser } from '../../types';
import './LoginPage.css';

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
    <div className="login">
      <div className="cockpit">
        {/* The window: looking out into the universe */}
        <div className="porthole">
          <div className="space">
            <div className="stars stars-far" />
            <div className="stars stars-mid" />
            <div className="stars stars-near" />
            <div className="nebula" />
            <div className="planet" />
            <div className="shooting-star" />

            {/* Spaceship drifting past outside the window */}
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
                {/* engine flame */}
                <ellipse className="thrust" cx="36" cy="45" rx="40" ry="11" fill="url(#flame)" />
                {/* hull */}
                <path
                  d="M60 45 C90 18 160 12 214 30 C226 34 232 40 232 45 C232 50 226 56 214 60 C160 78 90 72 60 45 Z"
                  fill="url(#hull)"
                />
                {/* fin */}
                <path d="M96 36 L120 8 L132 34 Z" fill="#6f7fa6" />
                <path d="M96 54 L120 82 L132 56 Z" fill="#55648a" />
                {/* cockpit glass */}
                <ellipse cx="186" cy="45" rx="16" ry="11" fill="#7fe9ff" opacity="0.95" />
                <ellipse cx="186" cy="45" rx="16" ry="11" fill="none" stroke="#dff7ff" strokeWidth="2" />
                {/* window lights */}
                <circle cx="120" cy="45" r="3.2" fill="#ffd86b" />
                <circle cx="138" cy="45" r="3.2" fill="#ffd86b" />
                <circle cx="156" cy="45" r="3.2" fill="#ffd86b" />
              </svg>
            </div>

            {/* curved glass reflection */}
            <div className="glass-glare" />
          </div>

          {/* hull frame + bolts around the window */}
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

        {/* The console: login controls */}
        <form className="console" onSubmit={handleSubmit}>
          <div className="brand">
            <span className="brand-mark">🚀</span>
            <div>
              <h1>Spaceship X26</h1>
              <p className="tagline">Pilot Authentication</p>
            </div>
          </div>

          <label className="field">
            <span>Pilot Name</span>
            <input
              type="text"
              value={username}
              autoComplete="username"
              placeholder="e.g. ada.lovelace"
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Access Code</span>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <p className="login-error">⚠ {error}</p>}

          <button type="submit" className="launch" disabled={submitting}>
            {submitting ? 'Authenticating…' : 'Initiate Launch Sequence'}
          </button>

          <div className="login-hints">
            <span className="hints-label">Demo logins · password {DEMO_PASSWORD}</span>
            <div className="hint-chips">
              {DEMO_LOGINS.map((demo) => (
                <button
                  type="button"
                  key={demo.username}
                  className="hint-chip"
                  onClick={() => applyHint(demo.username)}
                >
                  <strong>{demo.role}</strong>
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
