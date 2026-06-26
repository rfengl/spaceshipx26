import './App.css';

interface Props {
  pilot: string;
  onLogout: () => void;
}

// Placeholder shell shown after login. This will grow into the PRMS
// (resource discovery, usage, crew-lead admin) as features are built.
export default function Dashboard({ pilot, onLogout }: Props) {
  return (
    <main className="app">
      <header className="hero">
        <div className="hero-bar">
          <div>
            <h1>🚀 SpaceshipX26</h1>
            <p className="lead">Passenger Resource Management System</p>
          </div>
          <div className="pilot">
            <span className="pilot-name">{pilot}</span>
            <button className="ghost" onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <section className="card">
        <h2>Welcome aboard, {pilot}</h2>
        <p className="muted">
          Resource management systems are coming online. Earth → Mars.
        </p>
      </section>
    </main>
  );
}
