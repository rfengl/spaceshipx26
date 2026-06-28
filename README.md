# Spaceship X26 — Passenger Resource Management System (PRMS)

A full-stack app for the **Spaceship X26** mission (Earth → Mars): Crew Leads manage
passengers and onboard resources, passengers consume the resources their membership
tier permits, and **every change streams to connected clients in real time** over a
WebSocket — no refresh, no polling.

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS — a login, then
  role-aware dashboards: **Resources**, **Passengers**, **Crew Leads**,
  **Audit trail**, **Reports**, plus a passenger view with personal **history**.
- **Backend:** Node.js + Express 4 + TypeScript, **SQLite** (`better-sqlite3`) behind
  repository interfaces, JWT auth with bcrypt-hashed passwords, and a **WebSocket hub**
  that pushes resource changes live.

The frontend in [`client/`](client/) builds into [`public/`](public/), which the
backend in [`server/`](server/) serves as static files alongside the `/api` routes and
the `/ws/resources` socket.

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, native `WebSocket`
- **Backend:** Node.js (ESM, `>=20`), Express 4, TypeScript, better-sqlite3, `ws`, jsonwebtoken, bcryptjs
- **Security/ops:** helmet, cors, express-rate-limit, compression, morgan, dotenv
- **Tooling:** Prettier + lint-staged + husky (format-on-commit)

## Prerequisites

- **Node.js `>=20`** and npm

## Setup

```bash
npm run install:all  # installs server/ and client/ deps
```

No configuration is required — the app runs on sensible defaults and the database
auto-seeds on first run.

## Run — development

```bash
npm run dev          # backend (:3000) + frontend (:5173) together, hot-reload
```

Open **<http://localhost:5173>** (Vite proxies `/api` and `/ws` to the backend). The
database is created and **auto-seeded** on first run. Run them separately with
`npm run dev:server` / `npm run dev:client`.

## Run — production

```bash
npm run build        # client -> public/, server -> server/dist/
npm start            # serves the built app at http://localhost:3000
```

## Demo accounts

The DB is seeded with **3 crew leads** and **6 passengers**; all share the demo
password **`mars2026`**:

| Username            | Role / Tier          |
| ------------------- | -------------------- |
| `ada.lovelace`      | Crew Lead            |
| `grace.hopper`      | Crew Lead            |
| `katherine.johnson` | Crew Lead            |
| `nova.reyes`        | Passenger · Silver   |
| `priya.anand`       | Passenger · Gold     |
| `lena.park`         | Passenger · Platinum |

(Plus `milo.chen` (Silver), `tomas.vega` (Gold), `idris.cole` (Platinum).)

## Real-time resource updates

The brief lists **"Monitor real-time activity and usage reports"** as a Crew Lead
permission; this implements that directly. Resources update **live** — any change a crew
lead or passenger makes is pushed to every other connected client over a WebSocket within
the same request, so the crew dashboards reflect ship activity as it happens, with no
polling loop and no "refresh to see changes". Concretely, all of these broadcast instantly:

| Trigger                                          | Event              |
| ------------------------------------------------ | ------------------ |
| Provision / edit / refill / write-off a resource | `resource.updated` |
| Decommission / recommission                      | `resource.updated` |
| A passenger **uses** a resource (stock drops)    | `resource.updated` |
| Soft-delete a resource                           | `resource.removed` |

**How it works** ([`resourceWebSocketHub.ts`](server/src/infrastructure/ws/resourceWebSocketHub.ts) ↔ [`useResourceSocket.ts`](client/src/hooks/useResourceSocket.ts)):

- **Authenticated at the handshake.** The client connects to `/ws/resources?token=<JWT>`;
  the server verifies the token _live_ during `verifyClient`, so an unauthenticated or
  just-deleted/deactivated account is rejected (`401`) and never opens a connection.
- **Per-connection tier filtering.** Crew receive every change; a passenger only receives
  pushes for resources their **membership tier** can access — the exact same gate as
  `GET /api/me/resources`, so nothing above a passenger's tier is ever leaked over the
  socket. (Removals are just an id with no detail, so they go to everyone.)
- **Patch where the full list is held; refetch where it's ranked.** Pages that hold the
  whole list — the crew **Resources** page and the **passenger dashboard** — patch just
  the one changed row in place (no full refetch), guarded by a value-equality **no-op
  guard** ([`sameResource.ts`](client/src/utils/sameResource.ts)) that drops echoes
  carrying no real change. The crew **home dashboard**'s "lowest stock" panel is a
  _ranked subset_ of the whole inventory, so it refetches that subset on each change
  instead — patching a single row couldn't correctly re-rank it.
- **Self-healing.** The client auto-reconnects with backoff after a drop; the server
  cleans up on close/error.

**Why this shape.** The application layer publishes through a small port,
[`ResourcePublisher`](server/src/domain/ports/resourcePublisher.ts) (`publish(change)`),
and knows nothing about WebSockets — the hub is the adapter, wired in via DI. That keeps
the domain transport-agnostic (Dependency Inversion) and makes tests trivial: until
`attach` is called, `publish` is a no-op, so route/service tests run without a live
socket. Tier filtering lives **server-side** because the client is never trusted to
self-censor.

> **Scope note.** Real-time is applied where it earns its keep — the shared resource
> inventory, which multiple crew and passengers mutate concurrently. The bounded lists
> (passengers, crew leads) and the unbounded audit log are not live-streamed; the audit
> log is instead **paginated and filtered server-side** (see below), which is the right
> tool for a growing log and which would conflict with a patch-in-place live model.

## Project layout

```
client/src/
  pages/
    Login/                 login
    Dashboard/             crew home (live "lowest stock" panel)
    PassengerDashboard/    passenger home (tier-filtered, live)
    Resources/             crew CRUD + refill / write-off / (de)commission modals
    Passengers/            crew CRUD (add / edit / delete) modals
    CrewLeads/             roster + propose-swap workflow
    AuditTrail/            crew activity log (server-side paginated + filtered)
    PersonalHistory/       a passenger's own consumption history
    Reports/               aggregated, tier-grouped distribution summary
    Profile/               self-service profile + re-auth confirm
  components/              Layout, Modal/ConfirmDialog, Pagination(+Bar),
                           SearchInput, PasswordInput, CountdownToMars
  hooks/                   useAuth, useResourceSocket (live updates),
                           usePagination, usePersistentState, useMediaQuery
  api/                     typed fetch client (auth, resources, passengers,
                           crewLeads, reports, audit, profile)
  utils/sameResource.ts    value-equality guard for live no-op updates
server/src/
  domain/
    models.ts              entities + types
    membership.ts          tier ranking + access rules
    ports/                 repository + service interfaces (incl. ResourcePublisher)
  application/             AuthService, CrewLeadService, InventoryService, UsageService
  infrastructure/
    sqlite/                repository adapters (users, resources, audit, reporting, requests)
    security/              bcrypt hasher + JWT token service
    ws/                    ResourceWebSocketHub (real-time adapter)
  db/                      schema, connection, migrate, seed (+ CLI)
  routes/                  auth, resources, me, passengers, crew-leads, reports, health
  middleware/              authenticate / requireRole, 404, error handler
  container.ts             composition root (wires adapters into services)
  server.ts                bootstrap: migrate, seed, listen, attach WS hub
public/                    built frontend (generated; do not edit by hand)
```

## API

Base path `/api`. All non-auth routes require `Authorization: Bearer <token>`. The token
is signature-verified, but the **role is re-read from the database on every request**, so
permissions are always live (see the authorization note below).

| Method          | Path                                   | Who       | Description                               |
| --------------- | -------------------------------------- | --------- | ----------------------------------------- |
| POST            | `/api/auth/login`                      | public    | Authenticate → `{ token, user }`          |
| GET             | `/api/auth/me`                         | any       | Current user                              |
| POST            | `/api/auth/refresh`                    | any       | Re-issue a token                          |
| GET             | `/api/me/profile`                      | any       | Own profile                               |
| PUT             | `/api/me/profile`                      | any       | Update own profile (re-auth required)     |
| GET             | `/api/me/resources`                    | any       | Resources visible to my tier              |
| POST            | `/api/me/resources/:id/use`            | any       | Consume one unit (live stock drop)        |
| GET             | `/api/me/history`                      | any       | My own activity history                   |
| GET             | `/api/resources`                       | crew lead | List all resources                        |
| POST            | `/api/resources`                       | crew lead | Provision a resource                      |
| PUT             | `/api/resources/:id`                   | crew lead | Edit / (de)commission                     |
| DELETE          | `/api/resources/:id`                   | crew lead | Soft-delete                               |
| POST            | `/api/resources/:id/refill`            | crew lead | Add stock                                 |
| POST            | `/api/resources/:id/write-off`         | crew lead | Remove spoiled / lost stock (with reason) |
| GET             | `/api/passengers`                      | crew lead | List passengers                           |
| POST/PUT/DELETE | `/api/passengers[/:id]`                | crew lead | Create / update / soft-delete passenger   |
| GET             | `/api/crew-leads`                      | crew lead | List the crew leads                       |
| GET/POST        | `/api/crew-leads/requests`             | crew lead | List / propose a swap                     |
| POST            | `/api/crew-leads/requests/:id/approve` | crew lead | Approve a pending swap                    |
| POST            | `/api/crew-leads/requests/:id/reject`  | crew lead | Reject a pending swap                     |
| GET             | `/api/reports/high-demand`             | crew lead | Resources ranked by usage                 |
| GET             | `/api/reports/shortages`               | crew lead | Resources lowest on stock                 |
| GET             | `/api/reports/audit`                   | crew lead | Audit trail (paginated + filtered)        |
| GET             | `/api/reports/aggregate`               | crew lead | Tier-grouped distribution summary         |
| WS              | `/ws/resources?token=<JWT>`            | any       | Live resource-change stream (tier-gated)  |

> Resource **management** is crew-only; passengers never hit `/api/resources`. They
> discover and consume through `/api/me/resources`, which returns only their tier's
> resources — the single source of truth the WebSocket filter mirrors.

## Data model

A single **`users`** table represents everyone aboard — a **crew lead is a user with
`is_crew_lead = 1`**, a passenger is `0`. This is the single source of truth for roles
(the JWT role is derived from it at login and re-checked per request). Other tables:

- **`resources`** — name, `min_level` (required tier), `max_qty` / `remaining_qty`
  (stock, with `CHECK` constraints so it can never go negative or exceed capacity), and
  two independent lifecycle flags: `active` (soft-delete) and `is_decommissioned` (taken
  out of service but still visible). Rows are **never hard-deleted**.
- **`audit_trail`** — one append-only log of every resource activity: passenger `USE`,
  crew `REFILL` / `WRITE_OFF`, and lifecycle `PROVISION` / `DECOMMISSION` /
  `RECOMMISSION` / `DELETE`, with `amount` and an optional `note` (e.g. a write-off
  reason). Indexed on `resource_id`, `user_id`, `action`, and `created_at` (the last
  backs the newest-first paginated trail).
- **`crew_lead_change_requests`** — the swap workflow (PENDING → APPROVED/REJECTED).

Persistence sits behind `domain/ports` interfaces with SQLite adapters in
`infrastructure/`, so the domain stays decoupled from storage (and from the WebSocket
transport).

## Design decisions & scope (beyond the brief)

The brief defines three levels (basic passenger/resource management with tier-based
access; dynamic validation, tier upgrades, audit logging; reporting). On top of the core
requirements, a few **intentional extensions** were added — called out here so they read
as deliberate engineering choices, not scope drift:

- **Authentication (JWT + bcrypt).** The brief describes two distinct actors
  (Crew Leads vs Passengers) with different permissions, so a real auth boundary was
  added: bcrypt-hashed passwords and a signed JWT whose role is derived from
  `is_crew_lead`. `requireRole('CREW_LEAD')` gates all admin mutations.

- **Unified `users` model.** Crew leads and passengers are the same kind of entity
  (a person aboard) distinguished by a flag, rather than separate tables — simpler,
  with one source of truth for identity and role.

- **Append-only audit trail + server-side pagination.** Every resource activity is logged
  to one `audit_trail` table. Because that log grows unbounded, the audit endpoint
  **paginates and filters in SQL** (`WHERE` + `COUNT` + `LIMIT/OFFSET`, parameterized),
  returning one page plus a total count — the whole log never loads to render a screen.
  The bounded lists stay client-side, where it's simpler and plays nicely with live updates.

- **Soft-delete over hard-delete.** The brief requires provisioning and _decommissioning_
  resources (implemented as a reversible out-of-service flag, plus recommission to undo
  it). On top of that, neither passengers nor resources are ever truly removed — delete is
  a soft flag. This preserves history (the audit trail still resolves names for removed
  entities) and keeps destructive actions reversible.

- **Crew-lead governance with approval (swap workflow).** The brief fixes the ship at
  _exactly three_ Crew Leads but gives no mechanism to change them. Rather than
  hard-coding three immutable admins, this adds a **controlled rotation** that _preserves
  the "exactly three" invariant_: a crew lead **proposes** swapping a crew lead out and a
  passenger in; the change stays **PENDING** until a **different** crew lead **approves**
  it (separation of duties), at which point an atomic transaction performs the 1-for-1
  swap. This demonstrates a multi-actor approval state machine while honoring the brief's
  core constraint.

> **Authorization model.** The JWT authenticates **statelessly** (signature-verified
> identity), but the **role is re-read from the database on every request** (and on every
> WebSocket connect), so authorization is always current: a just-demoted crew lead loses
> crew powers immediately (not at token expiry), and a deleted account is rejected even
> with an otherwise-valid token. This costs one indexed lookup per request — negligible on
> local SQLite — in exchange for correct, live permissions, which is the right trade for a
> governance feature.

## Tests

```bash
npm test             # runs the server test suite (node:test via tsx)
```

The suite (run against an in-memory SQLite database) splits into three layers:

**Domain unit tests** — the access-control core, isolated and fast:

- `membership` — tier-inheritance access matrix (Platinum ⊃ Gold ⊃ Silver) and the level
  guard.
- `models` — `toPublicUser` never leaks the password hash and leaves its input untouched.

**Application-service unit tests** — each use-case service exercised directly, without HTTP:

- `authService` — role derivation from `is_crew_lead`, password verification.
- `crewLeadService` — the "exactly three crew leads" invariant and separation-of-duties
  across every propose / approve / reject branch.
- `usageService` — Level-2 real-time validation: tier-gated discovery and use, out-of-stock
  and decommissioned rejection, stock decrement with an audit entry, high-demand and
  shortage ordering.
- `inventoryService` — refill capped at the maximum, write-off bounded by remaining stock,
  decommission guards, and the REFILL / WRITE_OFF audit records.

**Route integration tests** — repositories, seeding, auth, resource & passenger CRUD with
role enforcement, refill / write-off stock rules, the audit trail (lifecycle logging +
server-side pagination and filtering), self-service profile with re-auth, the reporting
endpoints, and the crew-lead swap workflow (propose → approve keeps exactly 3, proposer
cannot self-approve, passengers cannot propose).

## AI usage disclosure

This solution was developed with AI assistance (Claude). All AI-generated code was
directed, reviewed, and refined by the author; architectural decisions, scope calls, and
the design tradeoffs above were made deliberately.
