import { Suspense } from 'react';
import { Link, Outlet } from 'react-router-dom';

import CountdownToMars from '../CountdownToMars';
import type { AuthUser } from '../../types';
import type { LayoutContext } from '../../hooks/useAuth';

interface Props {
  user: AuthUser;
  onLogout: () => void;
  refreshUser: () => Promise<void>;
}

const ROLE_LABEL: Record<AuthUser['role'], string> = {
  CREW_LEAD: 'Crew Lead',
  PASSENGER: 'Passenger',
};

export default function Layout({ user, onLogout, refreshUser }: Props) {
  return (
    <div className="mx-auto w-[min(720px,92vw)] px-0 pb-12 pt-5">
      <header className="mb-5 border-b border-white/[0.07] pb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <CountdownToMars />
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/profile"
              title="Edit your profile"
              className="whitespace-nowrap rounded-full border border-white/[0.12] px-[0.6rem] py-[0.3rem] text-[0.72rem] tracking-[0.04em] text-[#9fb3d8] no-underline transition hover:border-[#5ad0ff] hover:text-[#e8eefc] sm:px-[0.7rem] sm:py-[0.35rem] sm:text-[0.85rem]"
            >
              {user.username} · {ROLE_LABEL[user.role]}
            </Link>
            <button
              className="btn-ghost px-[0.7rem] py-[0.3rem] text-[0.72rem] sm:px-[1.1rem] sm:py-[0.35rem] sm:text-[0.85rem]"
              onClick={onLogout}
            >
              Log out
            </button>
          </div>
        </div>
        <Link to="/" className="block text-center text-inherit no-underline">
          <h1 className="m-0 text-[clamp(2rem,6vw,3.25rem)]">🚀 Spaceship X26</h1>
          <p className="mt-[0.15rem] text-[0.92rem] text-[#9fb3d8]">
            Passenger Resource Management System
          </p>
        </Link>
      </header>

      {/* Only the page body suspends while a code-split page loads; the header
          shell above stays mounted. */}
      <Suspense fallback={<p className="muted mt-10 text-center">Loading…</p>}>
        <Outlet context={{ user, refreshUser } satisfies LayoutContext} />
      </Suspense>
    </div>
  );
}
