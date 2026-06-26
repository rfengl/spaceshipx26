import './Dashboard.css';
import type { AuthUser } from '../../types';

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

const ROLE_LABEL: Record<AuthUser['role'], string> = {
  CREW_LEAD: 'Crew Lead',
  PASSENGER: 'Passenger',
};

// Placeholder shell shown after login. This will grow into the PRMS
// (resource discovery, usage, crew-lead admin) as features are built.
export default function Dashboard({ user, onLogout }: Props) {
  return (
    <main className="app">
      <header className="hero">
        <div className="hero-bar">
          <div>
            <h1>🚀 SpaceshipX26</h1>
            <p className="lead">Passenger Resource Management System</p>
          </div>
          <div className="pilot">
            <span className="pilot-name">
              {user.username} · {ROLE_LABEL[user.role]}
            </span>
            <button className="ghost" onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <section className="card">
        <h2>Welcome aboard, {user.username}</h2>
        <p className="muted">
          Signed in as {ROLE_LABEL[user.role]}. Resource management systems are
          coming online. Earth → Mars.
        </p>
      </section>
    </main>
  );
}
