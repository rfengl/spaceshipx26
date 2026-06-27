import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import Modal from '../../components/Modal/Modal';
import { listPassengers } from '../../api/passengers';
import {
  listCrewLeads,
  listRequests,
  proposeSwap,
  approveRequest,
  rejectRequest,
} from '../../api/crewLeads';
import type { ChangeRequest, Passenger } from '../../types';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const fieldLabel = 'flex flex-col gap-1.5 text-[0.8rem] text-[#9fb3d8]';

export default function CrewLeadsPage() {
  const { user } = useAuth();
  const isCrew = user.role === 'CREW_LEAD';

  const [crewLeads, setCrewLeads] = useState<Passenger[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [proposeOpen, setProposeOpen] = useState(false);
  const [demoteId, setDemoteId] = useState('');
  const [promoteId, setPromoteId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nameOf = (id: string) =>
    [...crewLeads, ...passengers].find((p) => p.id === id)?.name ?? 'someone';

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [crew, pax, reqs] = await Promise.all([
        listCrewLeads(),
        isCrew ? listPassengers() : Promise.resolve<Passenger[]>([]),
        isCrew ? listRequests() : Promise.resolve<ChangeRequest[]>([]),
      ]);
      setCrewLeads(crew);
      setPassengers(pax);
      setRequests(reqs);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function openPropose() {
    setDemoteId('');
    setPromoteId('');
    setProposeOpen(true);
  }

  async function submitPropose(event: FormEvent) {
    event.preventDefault();
    if (!demoteId || !promoteId) return;
    setSubmitting(true);
    setError(null);
    try {
      await proposeSwap(demoteId, promoteId);
      setProposeOpen(false);
      await refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function resolve(id: string, action: 'approve' | 'reject') {
    setError(null);
    try {
      await (action === 'approve' ? approveRequest(id) : rejectRequest(id));
      await refresh();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  const pending = requests.filter((r) => r.status === 'PENDING');
  // A crew lead can demote anyone except themselves.
  const demotable = crewLeads.filter((c) => c.id !== user.id);

  return (
    <>
      <Link to="/" className="back-link">
        ← Dashboard
      </Link>

      <section className="card">
        <div className="flex items-center justify-between gap-4 max-sm:mb-4">
          <h2 className="m-0 text-[1.1rem]">Crew Leads</h2>
          {isCrew && (
            <button className="btn" onClick={openPropose}>
              Propose swap
            </button>
          )}
        </div>

        {error && <p className="error mt-3">⚠ {error}</p>}

        {loading && crewLeads.length === 0 ? (
          <p className="muted mt-3">Loading crew leads…</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {crewLeads.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-4"
              >
                <span className="text-[1.6rem]">🎖️</span>
                <strong className="text-[1.05rem]">{c.name}</strong>
                <span className="text-[0.82rem] text-[#9fb3d8]">@{c.username}</span>
                <span className="mt-1 text-[0.7rem] uppercase tracking-[0.08em] text-[#7f93b8]">
                  Crew Lead
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {isCrew && (
        <section className="card">
          <h2 className="m-0 text-[1.1rem]">Pending change requests</h2>
          {pending.length === 0 ? (
            <p className="muted mt-3">No pending requests.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {pending.map((r) => {
                const isProposer = r.proposerId === user.id;
                return (
                  <li
                    key={r.id}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3"
                  >
                    <p className="m-0 text-[0.95rem]">
                      Promote <strong>{nameOf(r.promoteId)}</strong> → Crew Lead, demote{' '}
                      <strong>{nameOf(r.demoteId)}</strong> → Passenger
                    </p>
                    <p className="muted m-0 mt-1 text-[0.8rem]">
                      Proposed by {nameOf(r.proposerId)}
                    </p>
                    <div className="mt-2 flex gap-4">
                      {isProposer ? (
                        <span className="muted text-[0.85rem]">
                          Awaiting another crew lead’s approval…
                        </span>
                      ) : (
                        <>
                          <button
                            className="link-btn"
                            onClick={() => void resolve(r.id, 'approve')}
                          >
                            Approve
                          </button>
                          <button
                            className="link-btn text-[#ff9d9d]"
                            onClick={() => void resolve(r.id, 'reject')}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {proposeOpen && (
        <Modal title="Propose a crew-lead swap" onClose={() => setProposeOpen(false)}>
          <form className="flex flex-col gap-3.5" onSubmit={submitPropose}>
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
            <div className="mt-2 flex justify-end gap-2.5">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setProposeOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Propose swap'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
