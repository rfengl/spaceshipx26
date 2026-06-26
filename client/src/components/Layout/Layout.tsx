import { Link, Outlet } from 'react-router-dom';

import type { AuthUser } from '../../types';
import type { LayoutContext } from '../../hooks/useAuth';
import './Layout.css';

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
    <div className="app">
      <header className="hero">
        <div className="hero-top">
          <span className="pilot-name">
            {user.username} · {ROLE_LABEL[user.role]}
          </span>
          <button className="ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
        <Link to="/" className="brand-link">
          <h1>🚀 Spaceship X26</h1>
          <p className="lead">Passenger Resource Management System</p>
        </Link>
      </header>

      <Outlet context={{ user } satisfies LayoutContext} />
    </div>
  );
}
