# Phase 1 — build log

*Detail for this pass only. For the full arc across all phases, see [roadmap.md](../docs/roadmap.md).*

App lives at the repository root. Strategy: [`Client-Portal-Strategy.md`](../docs/Client-Portal-Strategy.md) · Schema: [`Architecture-and-Schema.md`](../docs/Architecture-and-Schema.md)

## Done

- [x] Next.js 16 + TypeScript + Tailwind v4 scaffold
- [x] **Design tokens** — warm paper/ink palette, editorial type scale, motion rhythm (`app/globals.css`)
- [x] **Voice layer** — natural-language dates, deadlines, health, ages, rounds, empty states, errors (`lib/copy.ts`), 13 tests passing
- [x] **Client lens, mobile-first at 375px**
  - [x] Workspace front door — roll-up health, unified "Needs you", project cards, brand library
  - [x] Project home — health banner, "you are here" timeline, deliverables, updates, decisions, documents
  - [x] Review screen — link-out, visible round counter, approve / send notes
  - [x] High-stakes deliverables have **no approve button on a phone** (§6b)
- [x] **Animation** — staggered entrance, gradient sweep, press feedback, full `prefers-reduced-motion` collapse
- [x] Accessibility — every colour pair ≥4.5:1 in light *and* dark, 44px+ targets, focus rings, `aria-live` errors
- [x] Error + not-found screens using the friendly error copy
- [x] Phase 1 SQL migration with RLS publish boundary (`supabase/migrations/0001_phase1_client_lens.sql`)
- [x] Verified: `npm test` 13/13 · `npm run lint` clean · `npm run build` clean · all 4 routes render

## Not built yet

- [ ] **Supabase project not provisioned.** App runs on `lib/data/demo.ts`; swapping in the real client means editing only `lib/data/index.ts`
- [ ] Magic-link auth (§6b) — schema and flow designed, not wired
- [ ] Server actions for approve / request-changes — currently a simulated 700ms round-trip in `components/review-form.tsx`
- [ ] Email: notifications, digests, reply-by-email, the "remind me at my desk" send
- [ ] Link access-check + health monitoring jobs (§3c)
- [ ] **Internal lens entirely** — tasks, My work, tagging, standup mode, SOP checklists (migration 0002)

## Decisions worth remembering

- **Rejected the design skill's own recommendation.** It suggested Poppins + `#2563EB` blue — precisely the generic SaaS look §6a exists to avoid. Took its accessibility rules, dropped its style output.
- **Fraunces / Instrument Sans / JetBrains Mono.** Not Inter, not Geist, not Poppins — those read as machine-made now.
- **"On track" is quiet.** Most portals shout green. Colour appears only when something needs attention, so it means something when it does.
- **Brand gradient is quarantined** to the mark plus one hairline per screen. Never cards, buttons, headers or backgrounds.
- **Typographic apostrophes throughout** — fixes the lint error *and* the editorial feel in one move.
- **`allowImportingTsExtensions`** enabled so `node --test` can run the copy tests directly with no test runner dependency.
