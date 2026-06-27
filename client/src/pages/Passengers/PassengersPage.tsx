import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import Modal from '../../components/Modal/Modal';
import ConfirmDialog from '../../components/Modal/ConfirmDialog';
import PasswordInput from '../../components/PasswordInput';
import SearchInput from '../../components/SearchInput';
import Pagination from '../../components/Pagination';
import {
  listPassengers,
  createPassenger,
  updatePassenger,
  deletePassenger,
  type PassengerChanges,
} from '../../api/passengers';
import {
  TIER_RANK,
  type MembershipLevel,
  type NewPassenger,
  type Passenger,
} from '../../types';

const TIERS: MembershipLevel[] = ['SILVER', 'GOLD', 'PLATINUM'];
const PAGE_SIZE_OPTIONS = [5, 10, 20, 30, 50];

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
const emptyForm: NewPassenger = {
  username: '',
  password: '',
  name: '',
  membershipLevel: 'SILVER',
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const fieldLabel = 'flex flex-col gap-1.5 text-[0.8rem] text-[#9fb3d8]';

export default function PassengersPage() {
  const { user } = useAuth();
  const isCrew = user.role === 'CREW_LEAD';

  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NewPassenger>(emptyForm);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleting, setDeleting] = useState<Passenger | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  // Any change to the search, sort, or page size returns to the first page.
  useEffect(() => {
    setPage(1);
  }, [query, sortKey, sortDir, pageSize]);

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

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setConfirmPassword('');
    setError(null);
    setFormOpen(true);
  }

  function openEdit(passenger: Passenger) {
    setEditingId(passenger.id);
    // Never load the current access code — blank means "keep unchanged".
    setForm({
      username: passenger.username,
      password: '',
      name: passenger.name,
      membershipLevel: passenger.membershipLevel,
    });
    setConfirmPassword('');
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setConfirmPassword('');
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    const username = form.username.trim();
    if (!name || !username) {
      setError('Name and username are required.');
      return;
    }

    const changingPassword = form.password !== '';
    if (!editingId && !changingPassword) {
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

    setSubmitting(true);
    setError(null);
    try {
      if (editingId) {
        const changes: PassengerChanges = {
          name,
          username,
          membershipLevel: form.membershipLevel,
        };
        if (changingPassword) changes.password = form.password;
        await updatePassenger(editingId, changes);
      } else {
        await createPassenger({
          username,
          password: form.password,
          name,
          membershipLevel: form.membershipLevel,
        });
      }
      closeForm();
      await refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  }

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

  const q = query.trim().toLowerCase();
  const filtered = q
    ? passengers.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.username.toLowerCase().includes(q) ||
          p.membershipLevel.toLowerCase().includes(q),
      )
    : passengers;

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'membershipLevel') {
      return (TIER_RANK[a.membershipLevel] - TIER_RANK[b.membershipLevel]) * dir;
    }
    return a[sortKey].localeCompare(b[sortKey]) * dir;
  });

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <>
      <Link to="/" className="back-link">
        ← Dashboard
      </Link>

      <section className="card">
        <div className="flex items-center justify-between gap-4 max-sm:mb-4">
          <h2 className="m-0 text-[1.1rem]">Passengers</h2>
          {isCrew && (
            <button className="btn" onClick={openCreate}>
              + Add passenger
            </button>
          )}
        </div>

        {error && !formOpen && <p className="error mt-3">⚠ {error}</p>}

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
                            <button className="link-btn" onClick={() => openEdit(p)}>
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

                <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                  <label className="flex items-center gap-2 text-[0.8rem] text-[#9fb3d8]">
                    Rows per page
                    <select
                      className="input py-[0.4rem]"
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                    >
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Pagination page={safePage} pageCount={pageCount} onPage={setPage} />
                </div>
              </>
            )}
          </>
        )}
      </section>

      {formOpen && (
        <Modal title={editingId ? 'Edit passenger' : 'New passenger'} onClose={closeForm}>
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
              {editingId ? 'Access Code (leave blank to keep current)' : 'Access Code'}
              <PasswordInput
                value={form.password}
                onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                placeholder={editingId ? '••••••••' : 'at least 4 characters'}
                required={!editingId}
              />
            </label>

            <label className={fieldLabel}>
              Confirm Access Code
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="re-enter access code"
                required={!editingId}
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
              <button type="button" className="btn-ghost" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={submitting}>
                {submitting ? 'Saving…' : editingId ? 'Save' : 'Add passenger'}
              </button>
            </div>
          </form>
        </Modal>
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
