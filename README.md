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
| `supabase/migrations/` | Phase 1 schema + RLS publish boundary |
| `docs/` | Strategy, architecture, roadmap |

## Three decisions worth knowing before you edit anything

**1. Every client-facing string comes from `lib/copy.ts`.**
Not scattered through components. It produces spoken English — *"Due on the 17th of this month"*, *"This was due last Sunday — 3 days ago"* — deterministically, with no language model involved. The tests assert the *phrasing*, because the wording is the contract. If you hardcode a string in a component, you've broken the voice.

**2. Visibility is enforced by Postgres, not by queries.**
Internal tables have no client RLS policy at all — not a filtered one, none. Application code cannot leak what the database will not return. Never "fix" a missing row by adding a service-role query.

**3. The brand gradient belongs to the mark.**
Logo, plus at most one hairline accent per screen. Never cards, buttons, headers or backgrounds. Colour otherwise appears only when something needs attention — "on track" is deliberately quiet. Most portals shout green; confidence is quieter than that.

## Conventions

- **Mobile-first for clients** (375px baseline), with a real desktop layout above `lg` — side rail on the story view, wider measure for the data views. Widening a container is not the same as designing for desktop; reading columns stay narrow.
- **Three project views**, driven by the `?view=` search param rather than client state — works without JS, the back button behaves, and a client can send their boss a link straight to the tracking sheet. `story` (default) · `sheet` · `board`.
- **Light by default.** Dark is opt-in via the toggle and remembered; `prefers-color-scheme` is deliberately *not* consulted — the studio's work is presented on paper-white unless someone chooses otherwise.
- High-stakes deliverables have no approve button on a phone — that's intentional, not a bug.
- **No file storage.** Every artifact is a link. There is no upload path by design.
- **Typographic apostrophes** (`’`) in all user-facing copy.
- **Type roles, not ad-hoc classes.** `.label` is uppercase mono for *naming a region* — never a sentence, never a date. `.meta` (sans, 14px) carries timestamps, rounds and statuses. Letterspaced uppercase micro-type is decoration; don't make people read it.
- Nothing carrying content sits below 14px.
- Type: Newsreader (display) / Instrument Sans (UI) / JetBrains Mono (labels only).

## Status

See [docs/roadmap.md](docs/roadmap.md) for what's done and what's next.

Not yet wired: auth, server actions, email, and the entire internal lens (tasks, standup, SOP checklists).
