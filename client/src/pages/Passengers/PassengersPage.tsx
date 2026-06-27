import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { usePersistentState } from '../../hooks/usePersistentState';
import { usePagination } from '../../hooks/usePagination';
import ConfirmDialog from '../../components/Modal/ConfirmDialog';
import SearchInput from '../../components/SearchInput';
import PaginationBar from '../../components/PaginationBar';
import AddPassengerButton from './AddPassengerButton';
import PassengerFormModal from './PassengerFormModal';
import { listPassengers, deletePassenger } from '../../api/passengers';
import { TIER_RANK, type Passenger } from '../../types';
import BackDashboardButton from '../../components/BackDashboardButton';

type SortKey = 'name' | 'username' | 'membershipLevel';

const SortHeader = ({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}) => {
  const active = sortKey === column;
  return (
    <th
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="cursor-pointer select-none hover:text-[#e8eefc]"
      onClick={() => onSort(column)}
    >
      {label}{' '}
      <span className="text-[#5ad0ff]">
        {active ? (sortDir === 'asc' ? '▲' : '▼') : ''}
      </span>
    </th>
  );
};
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

export default function PassengersPage() {
  const { user } = useAuth();
  const isCrew = user.role === 'CREW_LEAD';

  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Passenger | null>(null);
  const [deleting, setDeleting] = useState<Passenger | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = usePersistentState<SortKey>('passengers.sortKey', 'name');
  const [sortDir, setSortDir] = usePersistentState<'asc' | 'desc'>(
    'passengers.sortDir',
    'asc',
  );
  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setPassengers(await listPassengers());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // Patch the roster in place (add if new) after a create / edit.
  const applyPassenger = (p: Passenger) =>
    setPassengers((prev) =>
      prev.some((x) => x.id === p.id)
        ? prev.map((x) => (x.id === p.id ? p : x))
        : [p, ...prev],
    );

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await deletePassenger(deleting.id);
      setPassengers((prev) => prev.filter((p) => p.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return passengers;
    return passengers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q) ||
        p.membershipLevel.toLowerCase().includes(q),
    );
  }, [passengers, query]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === 'membershipLevel') {
        return (TIER_RANK[a.membershipLevel] - TIER_RANK[b.membershipLevel]) * dir;
      }
      return a[sortKey].localeCompare(b[sortKey]) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const { paged, paging } = usePagination(sorted, {
    storageKey: 'passengers.pageSize',
    resetKey: `${query}|${sortKey}|${sortDir}`,
  });

  return (
    <>
      <BackDashboardButton />

      <section className="card">
        <div className="flex items-center justify-between gap-4 max-sm:mb-4">
          <h2 className="m-0 text-[1.1rem]">Passengers</h2>
          {isCrew && <AddPassengerButton onCreated={applyPassenger} />}
        </div>

        {error && <p className="error mt-3">⚠ {error}</p>}

        {loading && passengers.length === 0 ? (
          <p className="muted mt-3">Loading passengers…</p>
        ) : passengers.length === 0 ? (
          <p className="muted mt-3">No passengers yet.</p>
        ) : (
          <>
            <div className="mt-3">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search name, username, or tier…"
              />
            </div>

            {filtered.length === 0 ? (
              <p className="muted mt-3">No passengers match “{query}”.</p>
            ) : (
              <>
                <table className="data-table mt-3">
                  <thead>
                    <tr>
                      <SortHeader
                        label="Name"
                        column="name"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={onSort}
                      />
                      <SortHeader
                        label="Username"
                        column="username"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={onSort}
                      />
                      <SortHeader
                        label="Membership tier"
                        column="membershipLevel"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={onSort}
                      />
                      {isCrew && <th aria-label="Actions" />}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((p) => (
                      <tr key={p.id}>
                        <td data-label="Name">{p.name}</td>
                        <td data-label="Username">{p.username}</td>
                        <td data-label="Membership tier">
                          <span className={`tier tier-${p.membershipLevel}`}>
                            {p.membershipLevel}
                          </span>
                        </td>
                        {isCrew && (
                          <td className="row-actions">
                            <button className="link-btn" onClick={() => setEditing(p)}>
                              Edit
                            </button>
                            <button
                              className="link-btn text-[#ff9d9d]"
                              onClick={() => setDeleting(p)}
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <PaginationBar {...paging} />
              </>
            )}
          </>
        )}
      </section>

      {editing && (
        <PassengerFormModal
          passenger={editing}
          onClose={() => setEditing(null)}
          onSaved={applyPassenger}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete passenger"
          message={
            <>
              Delete <strong>{deleting.name}</strong>? They will be removed from the
              roster and can no longer log in. Their record and history are retained.
            </>
          }
          confirmLabel="Delete"
          danger
          busy={deleteBusy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
