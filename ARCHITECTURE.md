# Architecture & design — Spaceship X26 PRMS

Companion to the [README](README.md): the deeper detail on how the system is built, and
why. The README covers what it is, how to run it, and the high-level approach.

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, native `WebSocket`
- **Backend:** Node.js (ESM, `>=20`), Express 4, TypeScript, better-sqlite3, `ws`, jsonwebtoken, bcryptjs
- **Security/ops:** helmet, cors, express-rate-limit, compression, morgan, dotenv
- **Tooling:** Prettier + lint-staged + husky (format-on-commit)

## Architecture

The backend is **hexagonal (ports & adapters)**: the domain depends only on interfaces
(ports); concrete adapters implement them and are wired together in a single composition
root. Dependencies point inward, so the domain never imports a framework or the database —
which is what makes the rules unit-testable and the storage/transport swappable details.

```
domain        entities, membership/access rules, ports (repository + service interfaces)
  ▲
application   use-case services: Auth, CrewLead, Inventory, Usage
  ▲
infrastructure  adapters: SQLite repositories, bcrypt hasher, JWT service, WebSocket hub
routes/mw     HTTP boundary: thin handlers, authenticate / requireRole, error handler
container.ts  composition root — builds adapters and injects them into services
```

**Patterns, where they earn their place:**

- **Repository** — `domain/ports/*Repository` with SQLite adapters in `infrastructure/sqlite`.
- **Adapter / Strategy** — `bcryptPasswordHasher`, `jwtTokenService`, and the WebSocket hub
  sit behind `PasswordHasher` / `TokenService` / `ResourcePublisher` ports, so each is
  interchangeable (bcrypt → argon2, JWT → sessions, socket → no-op) with no domain change.
- **Observer / publish–subscribe** — the application publishes resource changes through the
  `ResourcePublisher` port; the WebSocket hub is the subscriber/transport.
- **Dependency injection** — one composition root (`container.ts`); every service takes its
  ports by constructor.
- **DTO mapper** — `toPublicUser` strips the password hash at the boundary.
- **State machine + two-person rule** — the crew-lead swap (`PENDING → APPROVED/REJECTED`,
  proposer ≠ approver).

### Project layout

```
client/src/
  pages/
    Login/                 login
    Dashboard/             crew home (live "lowest stock" panel)
    PassengerDashboard/    passenger home (tier-filtered, live)
    Resources/             crew CRUD + refill / write-off / (de)commission modals
                           + per-resource analytics (usage trend, tier breakdown)
    Passengers/            crew CRUD (add / edit / delete) modals
    CrewLeads/             roster + propose-swap workflow
    AuditTrail/            crew activity log (server-side paginated + filtered)
    PersonalHistory/       a passenger's own consumption history
    Reports/               aggregated, tier-grouped distribution summary
    Profile/               self-service profile + re-auth confirm
  components/              Layout, Modal/ConfirmDialog, Pagination,
                           SearchInput, PasswordInput, CountdownToMars
  hooks/                   useAuth, useResourceSocket (live updates), useAsyncAction,
                           usePagination, usePersistentState, useMediaQuery
  api/                     typed fetch client (auth, resources, passengers,
                           crewLeads, reports, audit, profile)
  utils/                   errorMessage, sameResource (live no-op guard)
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
  db/                      schema, connection, migrate, seed (+ seedAuditTrail, CLI)
  routes/                  auth, resources, me, passengers, crew-leads, reports, health
  middleware/              authenticate / requireRole, 404, error handler
  container.ts             composition root (wires adapters into services)
  server.ts                bootstrap: migrate, seed, listen, attach WS hub
public/                    built frontend (generated; do not edit by hand)
```

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
> log is instead **paginated and filtered server-side**, which is the right tool for a
> growing log and which would conflict with a patch-in-place live model.

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
| GET             | `/api/reports/resources/:id/usage`     | crew lead | Per-resource daily usage + tier breakdown |
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

I tried to be deliberate about what I built beyond the literal requirements, so each call
reads as intent rather than scope drift. Three buckets: what's faithful to the brief, what
wasn't spelled out but I consider necessary for a working product, and the one feature I
added because I thought it was genuinely useful.

### Not spelled out, but necessary for a working product

- **Refill & write-off — completing the resource lifecycle.** The brief covers provisioning,
  decommissioning, and consuming resources, but stock that can only ever go _down_ isn't a
  working inventory: every resource would drain to zero with no way to recover, and no way
  to correct for spoiled or broken units. I closed the loop — **provision → use → refill →
  write-off → decommission/recommission → soft-delete** — so the system reflects how a
  resource actually behaves aboard a ship. Refill replenishes; write-off removes
  spoiled/broken/lost units (with a reason). Both land in the same audit trail, so the
  record stays complete.

- **Real-time over WebSocket.** The brief lists "monitor real-time activity," which I took
  literally: a crew lead shouldn't have to refresh to see a passenger drain the last oxygen
  pod. Changes push live to connected clients instead of being polled. I treat live state as
  a baseline for a modern operational dashboard, which is why it runs through the domain (a
  `ResourcePublisher` port) rather than being bolted on — design detail in the section above.

- **Authentication (JWT + bcrypt).** Two actors with very different powers can't share an
  open API, so there's a real auth boundary: bcrypt-hashed passwords and a signed JWT whose
  role derives from `is_crew_lead`. `requireRole('CREW_LEAD')` gates all admin mutations.

### A useful addition I chose to build

- **Per-resource usage trend.** L3 asks for usage analytics to prevent shortages, and the
  high-demand report already answers _"what's busy right now."_ I went further to make
  shortages _predictable_ rather than just visible: each resource has a 30-day usage trend,
  so a crew lead can catch one whose demand is climbing and refill it _before_ it runs out —
  proactive instead of reactive. A red capacity line shows headroom at a glance, and the
  by-tier breakdown shows who's driving demand. Backed by date-bucketed reporting queries;
  the seed simulates a realistic year so the views have genuine, time-varied data.

### Supporting decisions

- **Unified `users` model.** Crew leads and passengers are the same entity (a person aboard)
  distinguished by a flag — one source of truth for identity and role.

- **Append-only audit trail + server-side pagination.** Every activity is logged to one
  `audit_trail`; because it grows unbounded, the audit endpoint **paginates and filters in
  SQL** (`WHERE` + `COUNT` + `LIMIT/OFFSET`, parameterized) so the whole log never loads to
  render a screen.

- **Soft-delete over hard-delete.** Neither passengers nor resources are ever truly removed
  — delete is a soft flag — so history survives (the audit trail still resolves names) and
  destructive actions stay reversible.

- **Crew-lead governance with approval (swap workflow).** The brief fixes the ship at
  _exactly three_ Crew Leads but gives no way to change them. Rather than hard-coding three
  immutable admins, I added a **controlled rotation** preserving the invariant: a crew lead
  **proposes** a swap; it stays **PENDING** until a **different** crew lead **approves** it
  (separation of duties), then an atomic transaction performs the 1-for-1 swap.

> **Authorization model.** The JWT authenticates **statelessly** (signature-verified
> identity), but the **role is re-read from the database on every request** (and on every
> WebSocket connect), so authorization is always current: a just-demoted crew lead loses
> crew powers immediately (not at token expiry), and a deleted account is rejected even
> with an otherwise-valid token. This costs one indexed lookup per request — negligible on
> local SQLite — in exchange for correct, live permissions, which is the right trade for a
> governance feature.
