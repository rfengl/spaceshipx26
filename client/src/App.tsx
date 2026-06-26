import { useState } from 'react';

import LoginPage from './pages/Login/LoginPage';
import Dashboard from './pages/Dashboard/Dashboard';
import { loadStoredUser, logout } from './api/auth';
import type { AuthUser } from './types';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser());

  if (!user) {
    return <LoginPage onAuthenticated={setUser} />;
  }

  return (
    <Dashboard
      user={user}
      onLogout={() => {
        logout();
        setUser(null);
      }}
    />
  );
}
