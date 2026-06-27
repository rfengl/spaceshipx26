import { Link } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';

const NAV_ITEMS = [
  {
    to: '/resources',
    icon: '🛰️',
    title: 'Resources',
    description: 'Ship inventory and the membership tier each one requires.',
    crewOnly: true,
  },
  {
    to: '/passengers',
    icon: '🧑‍🚀',
    title: 'Passengers',
    description: 'Passenger profiles and their membership levels.',
    crewOnly: true,
  },
  {
    to: '/crew-leads',
    icon: '🎖️',
    title: 'Crew Leads',
    description: 'The administrators managing the ship (exactly three).',
    crewOnly: false,
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const isCrew = user.role === 'CREW_LEAD';
  const items = NAV_ITEMS.filter((item) => !item.crewOnly || isCrew);

  return (
    <>
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-col gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-6 text-inherit no-underline transition hover:-translate-y-0.5 hover:border-[#5ad0ff] hover:bg-[rgba(90,208,255,0.08)]"
          >
            <span className="text-[1.9rem]">{item.icon}</span>
            <h2 className="mb-0 mt-1 text-[1.15rem]">{item.title}</h2>
            <p className="m-0 text-[0.85rem] text-[#9fb3d8]">{item.description}</p>
          </Link>
        ))}
      </section>

      {!isCrew && (
        <p className="muted mt-5">
          Welcome aboard. Passenger resource discovery and usage are coming online…
        </p>
      )}
    </>
  );
}
