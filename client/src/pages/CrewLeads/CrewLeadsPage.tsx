import { Link } from 'react-router-dom';

export default function CrewLeadsPage() {
  return (
    <section className="card">
      <Link to="/" className="back-link">
        ← Dashboard
      </Link>
      <h2>Crew Leads</h2>
      <p className="muted">Crew lead administration (max three) is coming online…</p>
    </section>
  );
}
