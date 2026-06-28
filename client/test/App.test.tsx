import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';

import { RequireCrew, RequirePassenger } from '../src/App';
import type { AuthUser } from '../src/types';

// Render the real route guards inside a router whose parent route supplies the
// auth context they read (the same shape Layout provides in the app). The tree
// mirrors App: a crew-only branch and a passenger-only branch, both falling back
// to "/" when the role isn't allowed.
function renderAt(path: string, role: AuthUser['role']) {
  const context = {
    user: { id: '1', username: 'tester', role } as AuthUser,
    refreshUser: async () => {},
  };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Outlet context={context} />}>
          <Route path="/" element={<div>Home</div>} />
          <Route element={<RequireCrew />}>
            <Route path="resources" element={<div>Crew Admin Page</div>} />
          </Route>
          <Route element={<RequirePassenger />}>
            <Route path="history" element={<div>Passenger Page</div>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('role-based route access', () => {
  it('lets a crew lead into a crew-only page', () => {
    renderAt('/resources', 'CREW_LEAD');
    expect(screen.getByText('Crew Admin Page')).toBeDefined();
  });

  it('blocks a passenger from a crew-only page (redirected home)', () => {
    renderAt('/resources', 'PASSENGER');
    expect(screen.queryByText('Crew Admin Page')).toBeNull();
    expect(screen.getByText('Home')).toBeDefined();
  });

  it('lets a passenger into a passenger-only page', () => {
    renderAt('/history', 'PASSENGER');
    expect(screen.getByText('Passenger Page')).toBeDefined();
  });

  it('blocks a crew lead from a passenger-only page (redirected home)', () => {
    renderAt('/history', 'CREW_LEAD');
    expect(screen.queryByText('Passenger Page')).toBeNull();
    expect(screen.getByText('Home')).toBeDefined();
  });
});
