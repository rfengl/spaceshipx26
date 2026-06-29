# Spaceship X26 — Passenger Resource Management System (PRMS)

A full-stack app for the **Spaceship X26** mission (Earth → Mars): Crew Leads manage
passengers and onboard resources, passengers consume the resources their membership tier
permits, and **every change streams to connected clients in real time** over a WebSocket —
no refresh, no polling.

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS — a login, then role-aware
  dashboards: Resources (+ per-resource analytics), Passengers, Crew Leads, Audit Trail,
  Reports, plus a passenger view with personal history.
- **Backend:** Node.js + Express + TypeScript, **SQLite** (`better-sqlite3`) behind
  repository interfaces, JWT auth with bcrypt-hashed passwords, and a WebSocket hub that
  pushes resource changes live.

> Deeper detail — architecture, patterns, real-time design, full API, data model, and the
> deliberate extensions beyond the brief — lives in **[ARCHITECTURE.md](ARCHITECTURE.md)**.

## Quick start

Requires **Node.js `>=20`**. No configuration needed — the app runs on sensible defaults
and the database **auto-seeds a realistic year of activity** on first run.

```bash
npm run install:all   # install server/ and client/ deps
npm run dev           # backend (:3000) + frontend (:5173), hot-reload
```

Open **<http://localhost:5173>** (Vite proxies `/api` and `/ws` to the backend). For a
production build: `npm run build` then `npm start` (serves the built app at `:3000`).

### Demo accounts

3 crew leads + 6 passengers, all sharing the password **`mars2026`**:

| Username                                              | Role / Tier          |
| ----------------------------------------------------- | -------------------- |
| `ada.lovelace` · `grace.hopper` · `katherine.johnson` | Crew Lead            |
| `nova.reyes` · `milo.chen`                            | Passenger · Silver   |
| `priya.anand` · `tomas.vega`                          | Passenger · Gold     |
| `lena.park` · `idris.cole`                            | Passenger · Platinum |

## Approach

I built this to the brief's three levels on a **hexagonal (ports & adapters)** backend, so
the domain rules stay isolated and fully testable while the database and transport remain
swappable details:

- **L1 — access & discovery:** membership tiers with downward inheritance; resources gated
  by minimum tier; passengers see only what they may use; exactly three crew leads enforced.
- **L2 — dynamic validation & audit:** every consume / refill / write-off is validated at
  the point of use and written to one append-only audit trail; crew adjust tiers and stock.
- **L3 — reporting & insights:** personal history, tier-grouped aggregates, high-demand /
  shortage analytics, and per-resource usage trends.

A few intentions behind the choices:

- **Scope, drawn deliberately.** The access rules, validation, audit, and reporting are the
  brief. **Auth and the refill/write-off stock lifecycle** I treated as necessary to make it
  a real product — an inventory that can only deplete isn't a working one. The **per-resource
  usage trend** is the one feature I added because it makes shortages _predictable_ rather
  than just visible (catch rising demand and refill before it runs out). Full rationale in
  [ARCHITECTURE.md](ARCHITECTURE.md#design-decisions--scope-beyond-the-brief).
- **Optimised for "read, run, review."** One command runs everything and the DB
  auto-seeds, so a reviewer can click through a realistic ship in under a minute. Routes
  stay thin; logic lives in small, named services; cross-cutting concerns (error messages,
  async submit state) are factored once rather than copy-pasted.
- **SOLID where it pays.** Services depend on **ports, not implementations**, wired in a
  single composition root (DI). That's what makes the unit tests fast and the
  SQLite / bcrypt / JWT / WebSocket pieces interchangeable — Repository, Adapter/Strategy,
  and an Observer for live updates (details in ARCHITECTURE.md).
- **Edge cases pushed into the model.** Stock can't go negative or exceed capacity (DB
  `CHECK` constraints _and_ service guards); deletes are soft so history survives; and
  **authorization is re-read from the DB on every request**, so a demoted crew lead loses
  power immediately rather than at token expiry.
- **Honest about TDD.** I focused on meaningful, layered coverage (below). I'm still
  building fluency with strict TDD, so I practiced it genuinely on a couple of slices — the
  sort tie-break and the reporting queries, which appear as red→green commit pairs — and
  wrote the rest of the tests alongside the implementation. With more time I'd apply
  test-first more consistently.
- **Close to production-ready.** helmet, CORS, rate-limiting, compression, request logging,
  env-based config, and a clean, conventional commit history.

## Assumptions

- **Secure auth is a baseline, not optional.** The brief doesn't spell out login, but I assumed a real product with two privileged roles needs a genuine auth boundary — so passwords are **bcrypt-hashed** (never stored or compared in plaintext) and sessions use signed **JWTs**. (Self-contained JWT, not a third-party OAuth provider, to keep the review zero-dependency.)
- **Demo-grade auth.** All seeded accounts share one password (`mars2026`) and the JWT
  secret defaults to a dev value — fine for a review build, set via env in production.
- **Single ship / single tenant.** One vessel's worth of users and resources; no multi-ship or org separation.
- **SQLite as the datastore.** Chosen for zero-config review (auto-creates and seeds on
  first run); the repository ports mean moving to Postgres is an adapter swap, not a domain change.
- **"Real-time" means live push.** I read the brief's _"monitor real-time activity"_ as a
  no-refresh experience, so resource changes stream over a WebSocket rather than being
  polled — the domain publishes through a port and stays unaware of the transport (design in
  [ARCHITECTURE.md](ARCHITECTURE.md#real-time-resource-updates)).
- **"Exactly three crew leads" is an invariant, not a setting.** The ship seeds with three and the swap workflow keeps it there; there is deliberately no path to create a fourth.
- **Membership tiers are strictly ordered** (Silver < Gold < Platinum) with downward inheritance, per the brief.
- **Timestamps are UTC.** `created_at` and the trend windows are UTC; the UI formats to the viewer's locale.
- **Seeded history is simulated.** The year of activity is generated deterministically for realistic demo and report data — it isn't real usage.

## Testing

```bash
npm test              # server (node:test) + client (Vitest)
npm run test:server   # server only
npm run test:client   # client only
```

The bulk runs on the server (against in-memory SQLite), in layers:

- **Domain units** — tier-inheritance access matrix; `toPublicUser` never leaks the hash.
- **Application-service units** — each use-case service directly: the exactly-three
  crew-lead invariant + separation of duties, tier-gated use with out-of-stock /
  decommissioned rejection, refill/write-off stock bounds, and the audit records.
- **Security-adapter units** — JWT sign/verify (rejecting tampered / wrong-secret / expired)
  and bcrypt salting + comparison.
- **Route integration** — auth, CRUD with role enforcement, stock rules, the
  paginated/filtered audit trail, reporting, and the crew-lead swap workflow.

On the **client** (Vitest + Testing Library) the tests are behavioural — they assert real
requirements: the role-based route guards, the `apiFetch` auth boundary (token attach; 401
session-clear), session helpers, and the resource-action / refill / write-off stock rules.
The remaining screens are left to manual verification; effort is concentrated on the server
domain, per the brief.

## AI usage disclosure

Developed with AI assistance (Claude). All AI-generated code was directed, reviewed, and
refined by the author; the architecture, scope calls, and design tradeoffs (see
[ARCHITECTURE.md](ARCHITECTURE.md)) were deliberate decisions, not accepted as-is.
