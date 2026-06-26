import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from './pages/Login/LoginPage';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import ResourcesPage from './pages/Resources/ResourcesPage';
import PassengersPage from './pages/Passengers/PassengersPage';
import CrewLeadsPage from './pages/CrewLeads/CrewLeadsPage';
import { loadStoredUser, logout } from './api/auth';
import type { AuthUser } from './types';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser());

  if (!user) {
    return <LoginPage onAuthenticated={setUser} />;
  }

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout user={user} onLogout={handleLogout} />}>
          <Route index element={<Dashboard />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="passengers" element={<PassengersPage />} />
          <Route path="crew-leads" element={<CrewLeadsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
