import { useState } from 'react';

import LoginPage from './LoginPage';
import MissionControl from './MissionControl';

export default function App() {
  const [pilot, setPilot] = useState<string | null>(null);

  if (!pilot) {
    return <LoginPage onLogin={setPilot} />;
  }

  return <MissionControl pilot={pilot} onLogout={() => setPilot(null)} />;
}
