import { useEffect, useState, type FormEvent } from 'react';

import { listMissions, createMission, deleteMission } from './api';
import type { Mission, MissionStatus, NewMission } from './types';
import './App.css';

const STATUSES: MissionStatus[] = ['planned', 'active', 'completed'];

const emptyForm: NewMission = { name: '', status: 'planned', crew: 1 };

interface Props {
  pilot: string;
  onLogout: () => void;
}

export default function MissionControl({ pilot, onLogout }: Props) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<NewMission>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setMissions(await listMissions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load missions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createMission({ ...form, name: form.name.trim() });
      setMissions((prev) => [...prev, created]);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create mission');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const previous = missions;
    setMissions((prev) => prev.filter((m) => m.id !== id));
    try {
      await deleteMission(id);
    } catch (err) {
      setMissions(previous); // roll back on failure
      setError(err instanceof Error ? err.message : 'Failed to delete mission');
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <div className="hero-bar">
          <div>
            <h1>🚀 SpaceshipX26</h1>
            <p className="lead">Mission control — React + TypeScript frontend.</p>
          </div>
          <div className="pilot">
            <span className="pilot-name">Pilot {pilot}</span>
            <button className="ghost" onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <section className="card">
        <h2>New mission</h2>
        <form className="mission-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              type="text"
              value={form.name}
              placeholder="e.g. Lunar Survey"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>

          <label>
            Status
            <select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as MissionStatus }))
              }
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label>
            Crew
            <input
              type="number"
              min={0}
              value={form.crew}
              onChange={(e) =>
                setForm((f) => ({ ...f, crew: Number(e.target.value) || 0 }))
              }
            />
          </label>

          <button type="submit" disabled={submitting}>
            {submitting ? 'Launching…' : 'Add mission'}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Missions</h2>
          <button className="ghost" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error && <p className="error">⚠ {error}</p>}

        {loading && missions.length === 0 ? (
          <p className="muted">Loading missions…</p>
        ) : missions.length === 0 ? (
          <p className="muted">No missions yet. Add one above.</p>
        ) : (
          <ul className="mission-list">
            {missions.map((mission) => (
              <li key={mission.id} className="mission">
                <div>
                  <strong>{mission.name}</strong>
                  <span className={`badge badge-${mission.status}`}>
                    {mission.status}
                  </span>
                </div>
                <div className="mission-meta">
                  <span>👤 {mission.crew} crew</span>
                  <button
                    className="danger"
                    onClick={() => void handleDelete(mission.id)}
                    aria-label={`Delete ${mission.name}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
