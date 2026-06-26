import { Link } from 'react-router-dom';

import './Dashboard.css';

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
    <section className="nav-grid">
      {NAV_ITEMS.map((item) => (
        <Link key={item.to} to={item.to} className="nav-card">
          <span className="nav-icon">{item.icon}</span>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
        </Link>
      ))}
    </section>
  );
}
