# Griida Client Portal

A client portal for a design studio — and, on the studio side, the tool that runs the projects behind it.

The bet: clients rarely ask "what's the status?" because they want a status. They ask because they're anxious about control and money. So this is built as a trust instrument, not a ticket mirror.

**Phase 1 (the client-facing half) is built.** It runs on demo data until Supabase is provisioned.

---

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # voice-layer tests (13)
npm run build
```

Deployed on Vercel. The Cloudflare Workers setup (`wrangler.jsonc`, `open-next.config.ts`, `npm run deploy`) is kept in the repo and verified working on `workerd`, but the free Workers plan caps a Worker at 1 MiB and the Next.js SSR bundle exceeds it.

## What's here

| Path | |
|---|---|
| `app/` | Routes — workspace, project home, review screen |
| `components/` | Primitives and screen components |
| `lib/copy.ts` | **The voice layer** — every client-facing string |
| `lib/data/` | Read layer; swap `index.ts` to go live |
| `db/migrations/` | Phase 1 schema (Cloudflare D1 / SQLite) |
| `db/seed/` | Demo data, idempotent, relative dates |
| `db/reference/` | The original Postgres schema — read it to understand the intended visibility model |
| `lib/db/` | D1 access, the publish boundary, and the two query modules (client vs studio) |
| `docs/` | Strategy, architecture, roadmap |

## Three decisions worth knowing before you edit anything

**1. Every client-facing string comes from `lib/copy.ts`.**
Not scattered through components. It produces spoken English — *"Due on the 17th of this month"*, *"This was due last Sunday — 3 days ago"* — deterministically, with no language model involved. The tests assert the *phrasing*, because the wording is the contract. If you hardcode a string in a component, you've broken the voice.

**2. The publish boundary is enforced by code, and it is fragile by nature.**
It now works at **column** level too: `checklists`/`checklist_items` are client-readable, but `FORBIDDEN_CLIENT_COLUMNS` keeps `checked_by`, evidence and waiver reasons internal. Clients see which checks passed, not who signed them off.

This ran on Postgres RLS, where internal tables had no client policy and the engine could not be talked out of it. It now runs on **D1, which has no row-level security**, so the boundary lives in `lib/db/tables.ts`: every table is classified client-readable or internal, all client SQL lives in `client-queries.ts`, and `boundary.test.ts` fails the build if client SQL touches an internal table or isn't scoped by the caller's user id.

Adding a table forces a classification decision — the test fails otherwise. If a client needs a value that lives on an internal table, project it onto a client-readable one at write time. Never widen the boundary to make a query work.

**3. The brand gradient belongs to the mark.**
Logo, plus at most one hairline accent per screen. Never cards, buttons, headers or backgrounds. Colour otherwise appears only when something needs attention — "on track" is deliberately quiet. Most portals shout green; confidence is quieter than that.

## Conventions

- **Mobile-first for clients** (375px baseline), with a real desktop layout above `lg` — side rail on the story view, wider measure for the data views. Widening a container is not the same as designing for desktop; reading columns stay narrow.
- **Three project views**, driven by the `?view=` search param rather than client state — works without JS, the back button behaves, and a client can send their boss a link straight to the tracking sheet. `story` (default) · `sheet` · `board`.
- **Light by default.** Dark is opt-in via the toggle and remembered; `prefers-color-scheme` is deliberately *not* consulted — the studio's work is presented on paper-white unless someone chooses otherwise.
- High-stakes deliverables have no approve button on a phone — that's intentional, not a bug.
- **No file storage.** Every artifact is a link. There is no upload path by design.
- **Reachability and access are different questions.** A fetch can prove a URL resolves; it cannot prove a client can open a Figma or Drive link — those return 200 to anyone. So the gate needs a human attestation, recorded with who and when. Never merge the two into one tick.
- **Typographic apostrophes** (`’`) in all user-facing copy.
- **Type roles, not ad-hoc classes.** `.label` is uppercase mono for *naming a region* — never a sentence, never a date. `.meta` (sans, 14px) carries timestamps, rounds and statuses. Letterspaced uppercase micro-type is decoration; don't make people read it.
- Nothing carrying content sits below 14px.
- Type: Newsreader (display) / Instrument Sans (UI) / JetBrains Mono (labels only).

## Auth

Magic links only — no passwords anywhere (§6b). Links last 60 minutes and work once; sessions last 30 days with no sliding renewal. Tokens and session ids are SHA-256 hashed before storage, so a database leak yields nothing presentable.

The real authorisation check lives in `lib/auth/dal.ts`, next to the data. `proxy.ts` (Next 16 renamed Middleware to Proxy) only does optimistic cookie-presence redirects — it is **not** the security boundary and a forged cookie sails straight through it.

**Demo mode:** with no database credentials the app serves fixtures and requires no login. That is keyed off the *absence* of a database, so it can never be enabled somewhere that has real data to protect.

## Who can do what

| | Member | Lead | PM | Super admin |
|---|---|---|---|---|
| Work tasks, tick own checklist items | ✓ | ✓ | ✓ | ✓ |
| Countersign others' items | | ✓ | ✓ | ✓ |
| Publish updates to clients | | ✓ | ✓ | ✓ |
| Create projects and clients | | | ✓ | ✓ |
| Manage team, author SOP templates | | | | ✓ |

Defined once in `lib/studio/permissions.ts` and enforced in the server action, not just by hiding the button.

## Status

See [docs/roadmap.md](docs/roadmap.md) for what's done and what's next.

Not yet wired: auth, server actions, email, and the entire internal lens (tasks, standup, SOP checklists).
