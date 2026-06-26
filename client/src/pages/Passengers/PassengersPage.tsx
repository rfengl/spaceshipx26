import { Link } from 'react-router-dom';

export default function PassengersPage() {
  return (
    <section className="card">
      <Link to="/" className="back-link">
        ← Dashboard
      </Link>
      <h2>Passengers</h2>
      <p className="muted">Passenger profiles and membership levels are coming online…</p>
    </section>
  );
}
