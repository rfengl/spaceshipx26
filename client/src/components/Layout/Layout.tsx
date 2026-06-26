import { Link, Outlet } from 'react-router-dom';

import type { AuthUser } from '../../types';
import type { LayoutContext } from '../../hooks/useAuth';

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

const ROLE_LABEL: Record<AuthUser['role'], string> = {
  CREW_LEAD: 'Crew Lead',
  PASSENGER: 'Passenger',
};

export default function Layout({ user, onLogout }: Props) {
  return (
    <div className="mx-auto w-[min(720px,92vw)] px-0 pb-12 pt-5">
      <header className="mb-5 border-b border-white/[0.07] pb-4">
        <div className="mb-2 flex items-center justify-end gap-3">
          <span className="whitespace-nowrap rounded-full border border-white/[0.12] px-[0.7rem] py-[0.35rem] text-[0.85rem] tracking-[0.04em] text-[#9fb3d8]">
            {user.username} · {ROLE_LABEL[user.role]}
          </span>
          <button className="btn-ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
        <Link to="/" className="block text-center text-inherit no-underline">
          <h1 className="m-0 text-[clamp(2rem,6vw,3.25rem)]">🚀 Spaceship X26</h1>
          <p className="mt-[0.15rem] text-[0.92rem] text-[#9fb3d8]">
            Passenger Resource Management System
          </p>
        </Link>
      </header>

      <Outlet context={{ user } satisfies LayoutContext} />
    </div>
  );
}
