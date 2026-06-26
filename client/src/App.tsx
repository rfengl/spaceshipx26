import { useState } from 'react';

import LoginPage from './LoginPage';
import Dashboard from './Dashboard';

export default function App() {
  const [pilot, setPilot] = useState<string | null>(null);

  if (!pilot) {
    return <LoginPage onLogin={setPilot} />;
  }

  return <Dashboard pilot={pilot} onLogout={() => setPilot(null)} />;
}
