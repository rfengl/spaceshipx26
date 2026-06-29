import { useState } from 'react';

import { useAuth } from '../../hooks/useAuth';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { useAsyncLoad } from '../../hooks/useAsyncLoad';
import ProposeSwapButton from './ProposeSwapButton';
import { listPassengers } from '../../api/passengers';
import {
  listCrewLeads,
  listRequests,
  approveRequest,
  rejectRequest,
} from '../../api/crewLeads';
import type { ChangeRequest, Passenger } from '../../types';
import BackDashboardButton from '../../components/BackDashboardButton';

export default function CrewLeadsPage() {
  const { user } = useAuth();
  const isCrew = user.role === 'CREW_LEAD';

  const [crewLeads, setCrewLeads] = useState<Passenger[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);

  const nameOf = (id: string) =>
    [...crewLeads, ...passengers].find((p) => p.id === id)?.name ?? 'someone';

  // Load everything this page needs in one shot: the crew-lead roster, plus
  // (crew only) the passenger pool to promote from and the pending swap
  // requests. All three are small and unpaged — crew leads number a handful and
  // the roster is bounded — so we fetch them whole rather than server-paging.
  // `reload` re-runs all three after a swap is proposed or resolved.
  const { loading, error, reload } = useAsyncLoad(
    () =>
      Promise.all([
        listCrewLeads(),
        isCrew ? listPassengers() : Promise.resolve<Passenger[]>([]),
        isCrew ? listRequests() : Promise.resolve<ChangeRequest[]>([]),
      ]),
    ([crew, pax, reqs]) => {
      setCrewLeads(crew);
      setPassengers(pax);
      setRequests(reqs);
    },
  );
  const requestAction = useAsyncAction();

  async function resolve(id: string, action: 'approve' | 'reject') {
    await requestAction.run(async () => {
      await (action === 'approve' ? approveRequest(id) : rejectRequest(id));
      reload();
    });
  }

  const pending = requests.filter((r) => r.status === 'PENDING');
  // A crew lead can demote anyone except themselves.
  const demotable = crewLeads.filter((c) => c.id !== user.id);

  return (
    <>
      <BackDashboardButton />

      <section className="card">
        <div className="flex items-center justify-between gap-4 max-sm:mb-4">
          <h2 className="m-0 text-[1.1rem]">Crew Leads</h2>
          {isCrew && (
            <ProposeSwapButton
              demotable={demotable}
              passengers={passengers}
              onProposed={reload}
            />
          )}
        </div>

        {(error ?? requestAction.error) && (
          <p className="error mt-3">⚠ {error ?? requestAction.error}</p>
        )}

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
    </>
  );
}
