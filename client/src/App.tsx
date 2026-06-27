import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from './pages/Login/LoginPage';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import ResourcesPage from './pages/Resources/ResourcesPage';
import PassengersPage from './pages/Passengers/PassengersPage';
import CrewLeadsPage from './pages/CrewLeads/CrewLeadsPage';
import { useAuth } from './hooks/useAuth';
import { loadStoredUser, logout, fetchMe } from './api/auth';
import { getToken } from './api/client';
import type { AuthUser } from './types';

// Route guard: only Crew Leads may reach admin pages; others go home.
function RequireCrew({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user.role === 'CREW_LEAD' ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser());
  // When a token exists, re-verify with the server so a refreshed page shows the
  // live role (e.g. a demoted crew lead becomes a passenger).
  const [verifying, setVerifying] = useState<boolean>(() => Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    let active = true;
    fetchMe()
      .then((fresh) => {
        if (active) setUser(fresh);
      })
      .catch(() => {
        // A 401 is handled by the API client (clears session + reloads to login);
        // other errors (e.g. offline) keep the stored user.
      })
      .finally(() => {
        if (active) setVerifying(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (verifying) {
    return (
      <div className="grid min-h-screen place-items-center text-[#7f93b8]">Loading…</div>
    );
  }

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
          <Route
            path="resources"
            element={
              <RequireCrew>
                <ResourcesPage />
              </RequireCrew>
            }
          />
          <Route
            path="passengers"
            element={
              <RequireCrew>
                <PassengersPage />
              </RequireCrew>
            }
          />
          <Route path="crew-leads" element={<CrewLeadsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
