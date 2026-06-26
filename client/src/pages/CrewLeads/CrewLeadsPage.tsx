import { Link } from 'react-router-dom';

export default function CrewLeadsPage() {
  return (
    <>
      <Link to="/" className="back-link">
        ← Dashboard
      </Link>
      <section className="card">
        <h2 className="m-0 text-[1.1rem]">Crew Leads</h2>
        <p className="muted mt-3">
          Crew lead administration (max three) is coming online…
        </p>
      </section>
    </>
  );
}
