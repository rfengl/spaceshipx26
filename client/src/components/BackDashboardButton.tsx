import { Link } from 'react-router-dom';

export default function BackDashboardButton() {
  return (
    <Link to="/" className="back-link">
      ← Dashboard
    </Link>
  );
}
