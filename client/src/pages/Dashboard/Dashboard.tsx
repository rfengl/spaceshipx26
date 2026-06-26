import { Link } from 'react-router-dom';

const NAV_ITEMS = [
  {
    to: '/resources',
    icon: '🛰️',
    title: 'Resources',
    description: 'Ship inventory and the membership tier each one requires.',
  },
  {
    to: '/passengers',
    icon: '🧑‍🚀',
    title: 'Passengers',
    description: 'Passenger profiles and their membership levels.',
  },
  {
    to: '/crew-leads',
    icon: '🎖️',
    title: 'Crew Leads',
    description: 'Administrators managing the ship (exactly three).',
  },
];

export default function Dashboard() {
  return (
    <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {NAV_ITEMS.map((item) => (
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
  );
}
