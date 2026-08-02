# Griida Client Portal — Roadmap

*Single source of truth for where the build stands and what comes next.*

**Documents:** [Strategy](Client-Portal-Strategy.md) · [Architecture & Schema](Architecture-and-Schema.md) · [Phase 1 build log](../tasks/todo.md)
**Code:** repository root — Next.js 16, TypeScript, Tailwind v4, Postgres/Supabase
**Live:** https://griida-portal.vercel.app
**Last updated:** 1 August 2026

---

## Where we are

The **client-facing half of Phase 1 is built and verified.** A client can sign in (once auth is wired), see everything across their projects, and approve or send notes on work. The studio-facing half — tasks, standup, SOP checklists — has not been started.

| | Status |
|---|---|
| Strategy & architecture | ✅ Complete |
| Phase 1 — client lens | ✅ Built, running on demo data |
| Phase 1 — deployed | ✅ Live on Vercel, auto-deploys from `main` |
| Phase 1 — backend wiring | ✅ D1 live, auth working, both lenses reading real data |
| Phase 1 — internal slice | ⬜ Not started |
| Phase 2 — internal lens | 🟡 Studio UI built on demo data; writes not wired |
| Phase 3 — depth & learning loops | ⬜ Not started |

**Verified at last commit:** `npm test` 13/13 · `npm run lint` clean · `npm run build` clean · all 4 routes render.

---

## ✅ Done

### Foundation
- Next.js 16 + TypeScript + Tailwind v4 scaffold, pinned Turbopack root
- **Design tokens** ([`app/globals.css`](../app/globals.css)) — warm paper/ink palette, editorial type scale with named type roles (`.label` / `.meta`), one motion rhythm, light-default theming
- Type system: Fraunces (display) / Instrument Sans (UI) / JetBrains Mono (metadata)
- Brand gradient quarantined to the mark + one hairline per screen (§6a)

### The voice layer — [`lib/copy.ts`](../lib/copy.ts)
Every client-facing string generated from one module, deterministically. No language model (§6a).
- Natural dates: *"the 17th of this month"*, *"this Friday"*, *"tomorrow"*, *"3 October"*
- Deadlines as spoken sentences: *"It's due on the 12th of next month"*, *"This was due last Sunday — 3 days ago"*
- Health, ages, revision rounds, roll-up summaries, empty states, friendly errors
- **13 tests asserting phrasing, not just logic** — the wording *is* the contract

### Client lens — mobile-first at 375px
- **Workspace** ([`app/page.tsx`](../app/page.tsx)) — roll-up health, unified "Needs you" across all projects, project cards, brand library
- **Project home** ([`app/p/[slug]/page.tsx`](../app/p/[slug]/page.tsx)) — health banner with reason + date, "you are here" timeline, deliverables, updates, decision log, documents
- **Review screen** ([`app/p/[slug]/review/[id]/page.tsx`](../app/p/[slug]/review/[id]/page.tsx)) — link-out, visible round counter, approve / send notes
- **High-stakes work has no approve button on a phone** (§6b), with a notice explaining why
- Error and not-found screens using the friendly error copy

### Craft
- Staggered entrance (40ms), gradient sweep, press feedback; transform/opacity only; full `prefers-reduced-motion` collapse
- Every colour pair ≥4.5:1 in **both** light and dark, verified by computation
- 44px+ touch targets, visible focus rings, `aria-live` on errors, no horizontal page scroll

### Data
- [Phase 1 migration](../supabase/migrations/0001_phase1_client_lens.sql) — 23 tables, RLS publish boundary, immutable activity log, `can_publish_deliverable()` gate

### Deployment — configured and verified, not yet live
- `@opennextjs/cloudflare` adapter + wrangler installed
- [`wrangler.jsonc`](../wrangler.jsonc) — Workers Assets, `nodejs_compat`, observability on
- [`open-next.config.ts`](../open-next.config.ts)
- Scripts: `npm run cf-build` · `npm run preview` · `npm run deploy`
- **Verified running on workerd locally** — all 4 routes serve correctly (200/200/200/404), fonts self-hosted, copy intact

**Live on Vercel:** https://griida-portal.vercel.app — deployed from `main` via GitHub, auto-deploys on push.

Repo: https://github.com/chykeba/griida-portal (public)

Notes on the two hosting routes:

| Host | Status |
|---|---|
| **Vercel** | In use. Free Hobby tier, SSR, auto-deploy from `main`. `vercel.json` pins the framework preset in code, since the project had none and Vercel fell back to a static build |
| **Cloudflare Workers** | Config retained and verified on `workerd`, but the free plan caps a Worker at **1 MiB** and the Next.js SSR bundle is ~1.4 MiB compressed. Needs Workers Paid ($5/mo), then `npm run deploy` |

---

## ⬜ Phase 1 — remaining

Finishing what's started. This is the shortest path to something a real client can use.

**Deploy**
- [ ] Authenticate wrangler, then `cd portal && npm run deploy`
- [ ] **Put access protection on the preview URL before sharing it.** There is no auth yet, so a deployed URL is public to anyone holding it. The demo content is fictional, so nothing of a real client's leaks — but a public Griida-branded portal is a brand surface either way (Cloudflare Access, or a Worker-level basic-auth check, until magic-link lands)
- [ ] Revisit edge caching in `open-next.config.ts` **before** connecting Supabase — client pages are per-user and must never be cached at the edge. RLS protects the database, not a CDN cache

**Backend: now Cloudflare D1, not Supabase** ← *in progress*
- [x] Schema ported to SQLite and **applied to D1** (`griida_client_portal`, 35 tables, 3 triggers)
- [x] Append-only triggers on the audit logs, verified firing
- [x] **Publish boundary rebuilt in code** — D1 has no RLS, so `lib/db/tables.ts` classifies every table, all client SQL lives in `client-queries.ts`, and `boundary.test.ts` fails the build on a violation. Mutation-tested: injecting a join onto `tasks` fails the suite
- [x] D1 HTTP client with a runtime guard on client queries
- [x] D1 credentials verified; **read path wired live** — `lib/data/index.ts` reads through `client-queries.ts`, scoped to the session user
- [x] Cloudflare vars added to Vercel; production is out of demo mode
- [x] **Seeded** (`db/seed/0001_demo.sql`) — 6 users, 2 projects, 3 project types, 11 milestones, 5 deliverables, 7 tasks, 3 blockers, an 8-item SOP checklist with 4 signed attestations. Idempotent; dates are relative so the natural-language layer keeps working
- [x] Super admin: **hellogriida@gmail.com**
- [x] **Magic-link auth built** — 60-minute single-use links, 30-day absolute sessions, secrets SHA-256 hashed at rest, httpOnly/sameSite cookies
- [x] Data Access Layer (`lib/auth/dal.ts`) does the real check next to the data; `proxy.ts` (Next 16's renamed middleware) does optimistic redirects only, per Next's guidance
- [x] All 8 studio pages and 3 client pages gated
- [x] **Demo mode** — with no DB credentials the app serves fixtures and needs no login, so the public preview keeps working. Keyed off the *absence* of a database, so it cannot be on where there is real data
- [x] **Amazon SES** wired (`@aws-sdk/client-sesv2`), text + HTML parts, 7 tests on the wording and escaping
- [x] SES configured in Vercel and **confirmed delivering** — the full loop works end to end in production: request link → email arrives → single-use token → session → scoped D1 data
- [x] Swapped [`lib/data/index.ts`](../lib/data/index.ts) — verified end to end with real sessions against live D1
- [x] **Studio lens wired live** — `lib/studio/data.ts` reads D1 through `studio-queries.ts`; seven queries in one Promise.all pass, stitched in memory
- [x] Import-graph guard: the client data path is asserted never to import internal queries
- [x] **Client writes live** — approve / request changes persist to D1: review decision, feedback comment, deliverable status, activity event
- [x] **Billable rounds** — past the included rounds the client is warned *before* deciding, not blocked; a `revision_requests` row is raised for the studio to price
- [x] **Clients see the checklist result** — which checks passed, never who ticked them, the evidence, or what was waived (column-level boundary guard)
- [x] **Setup flows write to D1** — create project / client / invite. Creating a project instantiates milestones, deliverables and snapshotted checklists from the templates in the database
- [x] **Full SOP template library in D1** (`db/seed/0002_templates.sql`) — 7 checklist templates, 46 items. `lib/studio/templates.ts` is now only the demo-mode fallback
- [x] **Checklist writes live** — tick (with evidence), countersign, waive, untick. Every change appends to `checklist_item_events`; the `state` column is only a projection
- [x] **Countersign separation of duties enforced at write time**, not just in the UI — verified against live D1 that the person who checked an item cannot sign it off, super admin included
- [x] **Publish an update** from the project page and from standup — writes the update, bumps `last_published_at`, emits a client-visible activity event
- [x] **Notification emails wired** — publishing an update and sending work for review both email the client, deep-linked straight to the item (§6b). Failures are logged, never fatal: a courtesy on top of a fact
- [x] **The publish gate enforced at write time** — `sendToClient` re-derives it from the database, so a stale page can't push unfinished work at a client
- [x] **Review links manageable from the UI** — attach/replace a link, automatic reachability check, and a separate human attestation that this client can open it. Replacing a link resets the attestation
- [ ] `/studio/admin` — authoring SOP templates without writing SQL
- [ ] Super-admin UI to *author* templates — they live in the database now, but still need SQL to change

**Make the actions real**
- [ ] Server actions for approve / request changes → `reviews` + `feedback_comments`
- [ ] Client action responses (paste-a-link submissions)
- [ ] Link access-check before publish — the one gate with no override (§5b)

**Email** — the portal is inert without it
- [ ] Notification on new update / work ready for review, deep-linked (§6b)
- [ ] "Remind me at my desk" send
- [ ] Weekly client digest

**Thinnest internal slice that pays for itself**
- [ ] Deliverable ownership
- [ ] SOP checklist templates on **two** deliverable types (§5b)
- [ ] The client-visibility gate wired to the checklist
- [ ] Create-project-from-type — makes the SOP the default path, not extra work (§10.2)

**Definition of done for Phase 1:** one real client, on one real project, using it instead of email.

---

## 🟡 Phase 2 — the internal lens

The studio works inside the product; client updates fall out of that work.
**Screens are built and reading from demo data.** What remains is persistence.

- [x] Tasks — assignee, due date, status, linked to deliverable
- [x] **My work** (`/studio/my-work`) — per-person, across projects
- [x] **Tagging: responsible / blocker / mention** — three distinct meanings, structural not conventional (§5a)
- [x] **"Blocking others"** with aging clocks, surfaced on Today *and* My work
- [x] Aging everywhere — time-in-state on tasks, blockers, deliverables, client items
- [x] **Standup mode** (`/studio/standup`) — project-by-project walkthrough, generated entirely from existing data
- [x] **Publish from inside standup** (§7.1) — the ritual that keeps the portal never-stale
- [x] Drafted client update — deterministic templating, no model (§6a)
- [x] SOP checklist rendering: attestation, evidence links, countersign rules, publish gate
- [x] 11 tests covering the gate, countersign separation of duties, and the draft composer
- [x] **Setup flows** — create project from type, add client, invite team member, with server actions and permission checks
- [x] **Permission model** — PM + super admin create projects and clients; super admin alone manages team and authors SOPs. Checked in the action, not just the UI
- [x] **Project types + SOP template library** (3 types, 9 deliverable templates) with conditional items resolved at instantiation
- [ ] **Writes on existing work** — ticking, countersigning, waiving, task edits (still read-only)
- [ ] Append-only `checklist_item_events` log behind those writes
- [ ] Super-admin template *authoring* UI — templates are currently defined in `lib/studio/templates.ts`, readable but not editable in-app
- [ ] Real invitations — needs Supabase admin invite API; today an invited person appears immediately
- [ ] Project closeout checklist gating DONE
- [ ] Approvals audit trail, scope-change log, extra-revision request flow
- [ ] Reply-by-email inbound parsing (§10.3)
- [ ] "Seen by" on updates; automated nudges on overdue client items

> **Sequencing:** build **tagging and aging before standup mode.** Standup is a view over that data and has nothing to show without it.

---

## ⬜ Phase 3 — depth and learning loops

- [ ] Auto-generated **delivery index** from checklist links — the handoff moment (§4)
- [ ] Checklist telemetry — failure and waiver rates feeding SOP improvement
- [ ] Periodic link-health monitoring across archived projects
- [ ] **Estimate vs. actual** learned per project type (§10.6) — makes quoting accurate
- [ ] Light capacity view; studio-side weekly digest
- [ ] Case-study capture at closeout
- [ ] Recurring-client depth — "Start a new project" pre-fill, relationship history, retainer view
- [ ] Client-side SLA meter
- [ ] Guided intake wizard

---

## Open decisions

Blocking nothing today, but each changes what gets built.

1. **Does the internal layer replace the studio's current tool, or sit beside it?** Coexisting means double entry, which kills adoption. The single biggest decision remaining.
2. **Where do "final" links live so they survive?** Personal Drives break the archive value in §3a. Needs settling before the first closeout checklist is written.
3. **Which deliverable types are "high-stakes"** (no phone approval)? Probably direction-setting ones. Decide alongside the SOP templates.
4. **How often does standup actually run,** live or async? Build for the cadence the team already keeps.
5. **Real logo asset.** [`components/primitives.tsx`](../components/primitives.tsx) currently holds a geometric stand-in built to your mark's proportions — drop the real SVG into `public/` and swap it.

**Settled:** clients never see checklists (not even a badge) · no file storage, links only · no AI in the product · mobile-first for clients, desktop-first internally · gates warn-and-log except link access, which hard-blocks.

---

## Risks to watch

| Risk | Signal it's happening | Mitigation already designed |
|---|---|---|
| **Team won't use the internal layer** — loses both sides at once | Low weekly active use of *My work* | Publishing rides on standup, not willpower (§7.1) |
| **Checklists become theatre** | Waiver rate climbing | Cut waived items; keep templates to 7±3 (§5b) |
| **A broken link reaches a client** | Any occurrence — target is zero | Access-check gate + health monitoring (§3c) |
| **Portal goes stale** | "Last updated" drifting past a week | Drafted update from real events (§5a) |
| **Scope creep into a Jira** | Requests for story points, time tracking | Explicit anti-features list (§4) |
