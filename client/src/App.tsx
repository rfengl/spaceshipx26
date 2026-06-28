import { lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

import LoginPage from './pages/Login/LoginPage';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import PassengerDashboard from './pages/PassengerDashboard/PassengerDashboard';
import { useAuth } from './hooks/useAuth';
import { loadStoredUser, logout, fetchMe, refreshToken } from './api/auth';
import { getToken } from './api/client';
import type { AuthUser } from './types';

// Secondary pages are code-split: each is reached only by navigation, so it
// loads on demand instead of bloating the first paint. A passenger never
// downloads the crew-only admin pages, and vice-versa. The landing surfaces
// (login + the two home dashboards above) stay eager so there's no flash there.
const ResourcesPage = lazy(() => import('./pages/Resources/ResourcesPage'));
const ResourceAnalyticsPage = lazy(
  () => import('./pages/Resources/ResourceAnalyticsPage'),
);
const PassengersPage = lazy(() => import('./pages/Passengers/PassengersPage'));
const CrewLeadsPage = lazy(() => import('./pages/CrewLeads/CrewLeadsPage'));
const AuditTrailPage = lazy(() => import('./pages/AuditTrail/AuditTrailPage'));
const AggregatedReportsPage = lazy(() => import('./pages/Reports/AggregatedReportsPage'));
const PersonalHistoryPage = lazy(
  () => import('./pages/PersonalHistory/PersonalHistoryPage'),
);
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage'));

// While a session is active, swap the token for a fresh one well within its
// 1-hour expiry so staying on the site keeps the user logged in.
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// Home is role-specific: crew leads get the admin dashboard, passengers get
// their resource-discovery dashboard.
function Home() {
  const { user } = useAuth();
  return user.role === 'CREW_LEAD' ? <Dashboard /> : <PassengerDashboard />;
}

// Guard layout route: only Crew Leads may reach the admin pages nested under it;
// everyone else is redirected home. Exported for direct access-control testing.
export function RequireCrew() {
  const context = useAuth();
  return context.user.role === 'CREW_LEAD' ? (
    <Outlet context={context} />
  ) : (
    <Navigate to="/" replace />
  );
}

// Guard layout route: only Passengers may reach the passenger pages nested under it;
// everyone else is redirected home. Exported for direct access-control testing.
export function RequirePassenger() {
  const context = useAuth();
  return context.user.role === 'PASSENGER' ? (
    <Outlet context={context} />
  ) : (
    <Navigate to="/" replace />
  );
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

  // Keep an active session alive: while logged in, periodically swap the token
  // for a fresh one (and resync the live role). A failed refresh is handled by
  // the API client on the next request.
  const isLoggedIn = Boolean(user);
  useEffect(() => {
    if (!isLoggedIn || !getToken()) return;
    const id = setInterval(() => {
      refreshToken()
        .then(setUser)
        .catch(() => {});
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isLoggedIn]);

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

  const refreshUser = async () => {
    try {
      setUser(await fetchMe());
    } catch {
      // 401 is handled by the API client; ignore other (e.g. offline) errors.
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <Layout user={user} onLogout={handleLogout} refreshUser={refreshUser} />
          }
        >
          <Route index element={<Home />} />

          {/* Crew-only admin pages share a single guard. */}
          <Route element={<RequireCrew />}>
            <Route path="resources" element={<ResourcesPage />} />
            <Route path="resources/:id" element={<ResourceAnalyticsPage />} />
            <Route path="passengers" element={<PassengersPage />} />
            <Route path="audit-trail" element={<AuditTrailPage />} />
            <Route path="reports" element={<AggregatedReportsPage />} />
          </Route>

          <Route element={<RequirePassenger />}>
            <Route path="history" element={<PersonalHistoryPage />} />
          </Route>

          {/* Open to any signed-in user. */}
          <Route path="crew-leads" element={<CrewLeadsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
