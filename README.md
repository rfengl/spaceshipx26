# Spaceship X26 — Passenger Resource Management System (PRMS)

A full-stack app for the **Spaceship X26** mission (Earth → Mars): Crew Leads manage
passengers and onboard resources, and passengers access the resources permitted by
their membership tier.

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS — a spaceship-cockpit
  login, then a dashboard with **Resources**, **Passengers**, and **Crew Leads** pages.
- **Backend:** Node.js + Express 4 + TypeScript, **SQLite** (`better-sqlite3`) behind
  repository interfaces, JWT auth with bcrypt-hashed passwords.

The frontend in [`client/`](client/) builds into [`public/`](public/), which the
backend in [`server/`](server/) serves as static files alongside the `/api` routes.

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router
- **Backend:** Node.js (ESM, `>=20`), Express 4, TypeScript, better-sqlite3, jsonwebtoken, bcryptjs
- **Security/ops:** helmet, cors, express-rate-limit, compression, morgan, dotenv
- **Tooling:** Prettier + lint-staged + husky (format-on-commit)

## Prerequisites

- **Node.js `>=20`** and npm

## Setup

```bash
npm run install:all                 # installs server/ and client/ deps
cp server/.env.example server/.env  # optional: adjust values if needed
```

## Run — development

```bash
npm run dev          # backend (:3000) + frontend (:5173) together, hot-reload
```

Open **<http://localhost:5173>** (Vite proxies `/api` to the backend). The database
is created and **auto-seeded** on first run. Run them separately with
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

## Project layout

```
client/src/
  pages/            Login, Dashboard, Resources, Passengers, CrewLeads
  components/       Layout, Modal/ConfirmDialog
  api/              typed fetch client (auth, resources, passengers, crewLeads)
  hooks/useAuth.ts  current user via router context
server/src/
  domain/           entities (models.ts) + ports (repository interfaces)
  application/      AuthService, CrewLeadService (use-case logic)
  infrastructure/   SQLite repositories + security adapters (bcrypt, JWT)
  db/               schema, connection, migrate, seed
  routes/           auth, resources, passengers, crew-leads, health
  middleware/       auth (authenticate/requireRole), 404, error handler
  container.ts      composition root (wires adapters into services)
  test/             node:test suites (run via tsx)
public/             built frontend (generated; do not edit by hand)
```

## API

Base path `/api`. All non-auth routes require `Authorization: Bearer <token>`;
mutations are **Crew Lead only**.

| Method          | Path                                   | Who       | Description                         |
| --------------- | -------------------------------------- | --------- | ----------------------------------- |
| POST            | `/api/auth/login`                      | public    | Authenticate → `{ token, user }`    |
| GET             | `/api/auth/me`                         | any       | Current user                        |
| GET             | `/api/resources`                       | any       | List resources                      |
| POST/PUT/DELETE | `/api/resources[/:id]`                 | crew lead | Create / update / delete resource   |
| GET             | `/api/passengers`                      | any       | List passengers (crew leads hidden) |
| POST/PUT/DELETE | `/api/passengers[/:id]`                | crew lead | Create / update / delete passenger  |
| GET             | `/api/crew-leads`                      | any       | List the crew leads                 |
| GET             | `/api/crew-leads/requests`             | crew lead | List swap change-requests           |
| POST            | `/api/crew-leads/requests`             | crew lead | Propose a swap (demote + promote)   |
| POST            | `/api/crew-leads/requests/:id/approve` | crew lead | Approve a pending swap              |
| POST            | `/api/crew-leads/requests/:id/reject`  | crew lead | Reject a pending swap               |

## Data model

A single **`users`** table represents everyone aboard — a **crew lead is a user
with `is_crew_lead = 1`**, a passenger is `0`. This is the single source of truth
for roles (the JWT role is derived from it at login). Other tables: `resources`,
`usage_logs` (FK → users/resources), and `crew_lead_change_requests` (the swap
workflow). Persistence sits behind `domain/ports` interfaces with SQLite adapters
in `infrastructure/`, so the domain stays decoupled from storage.

## Design decisions & scope (beyond the brief)

The brief defines three levels (basic passenger/resource management with tier-based
access; dynamic validation, tier upgrades, audit logging; reporting). On top of the
core requirements, a few **intentional extensions** were added — called out here so
they read as deliberate engineering choices, not scope drift:

- **Authentication (JWT + bcrypt).** The brief describes two distinct actors
  (Crew Leads vs Passengers) with different permissions, so a real auth boundary was
  added: bcrypt-hashed passwords and a signed JWT whose role is derived from
  `is_crew_lead`. `requireRole('CREW_LEAD')` gates all admin mutations.

- **Unified `users` model.** Crew leads and passengers are the same kind of entity
  (a person aboard) distinguished by a flag, rather than separate tables — simpler,
  with one source of truth for identity and role.

- **Crew-lead governance with approval (swap workflow).** The brief fixes the ship
  at _exactly three_ Crew Leads but gives no mechanism to change them. Rather than
  hard-coding three immutable admins, this adds a **controlled rotation** that
  _preserves the "exactly three" invariant_: a crew lead **proposes** swapping a crew
  lead out and a passenger in; the change stays **PENDING** until a **different** crew
  lead **approves** it (separation of duties), at which point an atomic transaction
  performs the 1-for-1 swap. This demonstrates a multi-actor approval state machine
  while honoring the brief's core constraint.

> **Authorization model.** The JWT authenticates **statelessly** (signature-verified
> identity), but the **role is re-read from the database on every request**, so
> authorization is always current: a just-demoted crew lead loses crew powers
> immediately (not at token expiry), and a deleted account is rejected even with an
> otherwise-valid token. This costs one indexed lookup per request — negligible on
> local SQLite — in exchange for correct, live permissions, which is the right trade
> for a governance feature.

## Tests

```bash
npm test             # runs the server test suite (node:test via tsx)
```

Covers repositories, seeding, auth (role derivation), resource & passenger CRUD with
role enforcement, and the crew-lead swap workflow (propose → approve keeps exactly 3,
proposer cannot self-approve, passengers cannot propose).

## Configuration

Backend config is read from `server/.env` (see `server/.env.example`): `PORT`,
`HOST`, `NODE_ENV`, `CORS_ORIGIN`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`,
`DB_PATH`, and `JWT_SECRET` / `JWT_EXPIRES_IN`.

> **Set a strong `JWT_SECRET` in production** — the default is for local dev only.

## AI usage disclosure

This solution was developed with AI assistance (Claude). All AI-generated code was
directed, reviewed, and refined by the author; architectural decisions, scope calls,
and the design tradeoffs above were made deliberately.
