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
| Phase 1 — backend wiring | ⬜ Migration written, not provisioned |
| Phase 1 — internal slice | ⬜ Not started |
| Phase 2 — internal PM layer | ⬜ Not started |
| Phase 3 — depth & learning loops | ⬜ Not started |

**Verified at last commit:** `npm test` 13/13 · `npm run lint` clean · `npm run build` clean · all 4 routes render.

---

## ✅ Done

### Foundation
- Next.js 16 + TypeScript + Tailwind v4 scaffold, pinned Turbopack root
- **Design tokens** ([`app/globals.css`](../app/globals.css)) — warm paper/ink palette, editorial type scale, one motion rhythm, full dark mode
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

**Backend wiring**
- [ ] Provision the Supabase project *(your call — I haven't done this unprompted)*
- [ ] Run migration 0001; seed project types, milestone templates, deliverable types
- [ ] Swap [`lib/data/index.ts`](../lib/data/index.ts) from demo to live — **the only file that changes**
- [ ] Magic-link auth + session middleware (§6b — no passwords on phones)

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

## ⬜ Phase 2 — the internal lens

The studio works inside the product; client updates fall out of that work.

- [ ] Tasks — assignee, due date, status, linked to milestone/deliverable
- [ ] **My work** — per-person, across projects. *If a designer wouldn't open this each morning, the layer has failed*
- [ ] **Tagging: responsible / blocker / mention** — three distinct meanings, not one @ (§5a)
- [ ] **"Blocking others"** screen with aging clocks
- [ ] Aging everywhere — time-in-state on deliverables, blockers, client items
- [ ] **Standup mode** (§5c) — project-by-project walkthrough, generated from existing data
- [ ] **Publish from inside standup** — the ritual that keeps the portal never-stale (§7.1)
- [ ] Drafted client update — deterministic templating from logged events
- [ ] Full SOP checklist library + append-only event log + countersigning
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
