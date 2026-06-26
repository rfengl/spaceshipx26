import { Link } from 'react-router-dom';

export default function PassengersPage() {
  return (
    <>
      <Link to="/" className="back-link">
        ← Dashboard
      </Link>
      <section className="card">
        <h2 className="m-0 text-[1.1rem]">Passengers</h2>
        <p className="muted mt-3">
          Passenger profiles and membership levels are coming online…
        </p>
      </section>
    </>
  );
}
