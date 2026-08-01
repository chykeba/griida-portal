# Griida Client Portal — Strategy & Feature Blueprint

*A working document distilled from a cross-disciplinary design brainstorm. Focus: giving design-studio clients a clear, trustworthy view of where their project stands.*

> **Context note:** Griida is a **design studio** — product/UI design, brand identity design, and websites (WordPress-scale, not heavy custom-coded web apps). Different engagement types follow different journeys, so the portal uses **milestone templates per project type** rather than one hardcoded lifecycle. Two studio-specific realities shape the whole design: (1) deliverables are *visual and emotional* (logos, mockups, brand systems), so capturing feedback and approvals cleanly is the core job; (2) **the portal itself is a brand artifact** — for a studio that sells taste, it must look designed, not clunky.

> **Scope update:** the portal is no longer client-facing only. It is **one system with two lenses** — the studio runs its projects inside it, and a curated slice is published to the client. This adds an internal project-management layer (§5a) and an **SOP-driven deliverables checklist system** (§5b) that gates when work can be called done. See §3b for how the two sides relate.

> **Design constraints:** the client experience is **mobile-first, not responsive-as-an-afterthought** (§6b), and the product **must not look or behave like an AI product** (§6a) — including no language model behind the drafted updates. For a studio selling taste, a generated-looking portal undercuts the entire pitch.

> **Two hard constraints (§3c):** (1) **The portal stores no files.** Every artifact is a *link* — Figma, Drive, staging URL, Loom, PDF in Drive. The portal is a system of record for status, links, decisions and approvals; the files stay where they already live. (2) **Clients see three things only:** the timeline, published updates (each carrying a review link or document link), and the review/approval action. Internal tasks, checklists, evidence and SOPs are never client-visible.

---

## 1. The core insight

Clients rarely ask "what's the status?" because they want a status. They ask because they feel **anxiety about control and money**. A status portal is really a **trust instrument**. Every design decision below serves one job: reduce the client's uncertainty faster than they can generate it.

The failure mode to avoid: building a read-only ticket mirror. Clients think in *"Where's my project, what do you need from me, and when do I see the next thing?"* For a design studio, delay and friction come from two places: **client-side inputs** (brand info, content, assets, decisions) and **messy revision cycles** (scattered, contradictory feedback; "just one more direction"). The portal's main jobs are to make those blockers unmissable and to make feedback and approvals clean, consolidated, and logged.

**Design principle stack (in priority order):**

1. **Answer the anxious question first.** The top of every screen answers "Are we on track?" before anything else.
2. **Translate, don't expose.** Never show raw engineering artifacts untranslated. Map internal work to client-legible milestones.
3. **Make the client's own blockers unmissable.** The #1 cause of slipped software projects is client-side latency (feedback, assets, approvals). Surface those louder than your own tasks.
4. **Progress must feel earned, not decorative.** No fake percentage bars. Tie progress to visible, verifiable artifacts.
5. **One source of truth.** The portal replaces status-update emails, not supplements them.

---

## 2. Who it's for (personas)

| Persona | What they need | What they fear |
|---|---|---|
| **Economic buyer** (founder/exec paying) | Is this on time and on budget? Is my money working? | Silent overruns, vague progress |
| **Project sponsor** (day-to-day contact) | What do I owe you? What's next? Can I show my boss? | Being the bottleneck; looking uninformed internally |
| **Reviewer/stakeholder** (occasional) | Where do I click to approve/comment? | Getting lost, missing a deadline |

Design for the **anxious sponsor** as primary. They log in most, and they're the one relaying your competence to the buyer.

---

## 3. Information architecture

**Two levels.** A client is an *account* that can hold several projects and return over time, so the structure is **Client Workspace → Project**. Don't open straight into a single project — that's the wrong front door for a client with three jobs running.

**Level 1 — Client Workspace (the account front door):**
- **Roll-up health signal** — one glance answers "is everything okay across all my projects?" before any drill-down.
- **Project cards** — every active project as a card with its own health status and next milestone ("Rebrand — on track"; "App UI — waiting on you"; "Website — launches Fri").
- **Unified "Waiting on you"** — client action items **aggregated across all projects** into one to-do list, not three scattered ones.
- **Account brand library** — a persistent, labelled **index of links** to brand assets, logins, final deliverables, and preferences that **carries across every project** (see recurring-client model, §3a; storage constraint, §3c). New projects start half-set-up.
- **Retainer / care plan** — ongoing support lives here at the account level, not buried in a project.
- **"Start a new project"** — an obvious entry point for returning clients (quietly a sales channel too).
- **Past projects** — an archive the client can revisit; part of what makes leaving you feel like losing history.

**Level 2 — Project Home (the one screen that matters *inside* a project):**
- **Health banner** — On track / At risk / Blocked, with one plain-English sentence of why.
- **Next milestone** — Name, target date, and % of *scope* complete (not time).
- **Waiting on you** — Client-side action items with due dates (these also roll up into the workspace-level unified list). This is the highest-value module.
- **Recent activity** — 3–5 human-written or auto-translated updates ("Checkout flow now handles failed payments").
- **Latest preview** — Link/embed to the newest staging build or demo.

- **Timeline / Roadmap** — A horizontal "you are here" path, using a **template picked per engagement type** at kickoff:
  - *Brand identity:* Discovery → Moodboard/direction → Concepts → Refinement → Final assets & guidelines
  - *Product / UI design:* Research → Wireframes → UI design → Prototype → Handoff
  - *Website:* Kickoff → Design → Content collection → Build → Review → Launch → Aftercare
  Avoid Gantt density; every client should instantly see which stage they're in and what's next.
- **Deliverables** — Every shippable artifact (logo concepts, moodboards, mockups, prototypes, design systems) as a **link** with status: Draft → In Review → Approved → Delivered. These are visual and emotional — present them beautifully: embed the Figma/Drive source where possible, otherwise a strong typographic card (§3c). Version history is a list of rounds, each with its own link.
- **Approvals & Feedback** — Where clients review and sign off. Feedback on a deliverable is **consolidated in one place** (not scattered across emails), threaded, resolvable, with clear "your turn / our turn" states. Encourage the client to speak with one voice before feedback counts as submitted.
- **Revision tracker** — Visibly shows **"Revision Round 1 of 2 included."** Extra rounds are a logged, acknowledged decision with a shown cost — never an ambush. This is the studio's margin protection (see §5).
- **Documents & Assets** — A **link registry**: contracts, SOW, brand inputs, guidelines — each labelled, dated, owned, so nothing lives in email.
- **Budget / Scope** *(optional, gated)* — Fees/hours consumed vs. planned, and a visible change-log for scope changes.
- **People & Contacts** — Who's who on both sides, response-time expectations, escalation path.
- **Messages** — Lightweight, project-scoped comms that don't fragment across email/Slack.

**Access control spans both levels.** Roles are set *per project inside the account* — someone can be an owner on the rebrand but only a viewer on the website. Not one global role.

---

## 3a. The recurring-client model (retention lever)

Recurring clients are where the margin and the loyalty live, and most portals under-build for them. The account persists between engagements, so a returning client should feel *remembered*, not re-onboarded:

- **Nothing is re-collected.** Links to their brand assets, logins, preferences, and past deliverables are already in the account brand library. Project #3 starts half-set-up. (Caveat: link durability — see §3c.)
- **A relationship, not a transaction.** The workspace shows history — past projects, what you've delivered together — so the relationship feels cumulative. Switching studios starts to feel like losing an archive.
- **Retainers made visible.** For care plans / ongoing support, the account-level view shows what's been done and value delivered each period — turning one-off projects into recurring revenue.
- **Frictionless re-engagement.** "Start a new project" is one click, pre-filled from what you already know about them. Lower friction to say yes again.

Design implication: the **brand library and preferences live at the account level, inherited by each project** — never siloed inside a single job.

---

## 3b. The two-sided model — internal workspace ↔ client view

The portal has **one data model and two lenses**. The studio works in the internal lens; the client sees a curated, published slice of the same objects. This is not two products sharing a login — it's one project record viewed at two altitudes.

**Why this matters more than it sounds.** §7 names the real risk: manual updates go stale and the portal dies. Once the team's actual work lives in the same system, the portal can **pre-draft the client update from what actually happened** — a deliverable moved to review, a milestone's checklists completed, a task slipped past its due date. The PM's ritual becomes *review the auto-drafted diff, edit one sentence, publish.* The adoption risk isn't mitigated; it's designed out.

**The publish boundary.** Nothing internal reaches the client automatically. Three tiers:

| Tier | Examples | Client sees it |
|---|---|---|
| **Internal-only** | Tasks, assignees, internal notes, checklist evidence, capacity, unfinished work | Never |
| **Auto-propagated facts** | Deliverable moves to *In Review*, approval recorded, milestone completed | Immediately (these are facts the client is entitled to) |
| **Curated narrative** | Health status, "why," the weekly update, at-risk explanations | Only on explicit **Publish** |

Design rules that keep this safe:
- **Default private.** Every new object is internal until published. No opt-out-to-hide.
- **Visually unmistakable chrome.** The internal lens looks different — different surface color, an "Internal" rail. Ambiguity here is a trust-killer, and one leaked internal note costs more than the feature earns.
- **A publish preview.** Before publishing, the PM sees exactly what the client will see, diffed against what they saw last time.

**Roles (studio side), layered on top of the per-project client roles in §3:**

| Role | Can do |
|---|---|
| **Super Admin** | Define project types, deliverable types, SOP checklist templates, org settings. The only role that authors SOPs. |
| **Studio Admin / PM** | Run projects, assign work, set health, publish to client, waive checklist items with reason |
| **Lead / Reviewer** | Countersign checklist items flagged as requiring review |
| **Team Member** | Work tasks, tick and evidence checklist items **on deliverables they're assigned to** |

Deliberately: a Team Member cannot publish to the client, and cannot author or edit an SOP template. Authoring is centralized so the SOP means something.

**What the client actually sees.** Narrower than §3 might imply — three things:

1. **The timeline** — where we are, what's next.
2. **Updates** — each one optionally carrying a **review link** (Figma, prototype, staging site) or a **document link** (proposal, guidelines, invoice).
3. **The review action** — approve or request changes, with written feedback, directly in the portal.

Everything else — tasks, assignees, checklists, evidence, SOP templates, waivers, internal notes — is internal-only, permanently. The client never learns a checklist exists; they only experience its effect, which is that nothing half-finished ever reaches them.

---

## 3c. Links, not files — the storage constraint

**The portal hosts nothing.** No uploads, no asset storage. Every artifact is a **link** to where it already lives: Figma files and prototypes, Google Drive folders and documents, staging URLs, Loom recordings, PDFs in Drive. The portal is the **system of record for status, decisions, and approvals** — not a file store.

This is a good constraint. It removes storage cost, versioning headaches, sync ambiguity ("which copy is current?"), and most of the security surface. But it changes several things the earlier sections assumed:

| Section | Was | Becomes |
|---|---|---|
| Account brand library (§3, §3a) | Asset vault | **Link vault** — a curated, labelled index of where the client's brand assets, source files, and past deliverables live |
| Deliverables gallery (§4) | Large uploaded previews | **Link cards** — see "the preview problem" below |
| Documents & Assets (§3) | Shared file vault | **Link registry** — contracts, SOW, brief, guidelines, each a labelled link with owner and date |
| Client input checklist (§4, §5A) | Client uploads assets | Client **pastes a link** to a Drive folder or file, per item |
| Checklist evidence (§5b) | File in a slot | **Link in a slot** — plus a short note |
| Handoff bundle (§4) | Zip of final files | **Delivery index** — one page listing every final link, generated from the checklist |

**The preview problem — flag it honestly.** §4 calls the deliverables gallery "the emotional heart of the portal," built on large beautiful previews. Without uploads you can't render arbitrary artwork. Three fallbacks, in order:

1. **Embed where the source supports it** — Figma and Drive both embed; a prototype or moodboard can render live inside the portal. This covers most design deliverables and is arguably *better* than a static preview.
2. **Auto-fetch the link's preview image** (OG metadata / provider thumbnail) — works for Loom, YouTube, many sites.
3. **A well-designed typographic card** — deliverable name, type, round, date, status. If the studio's type and layout are good, this still looks intentional rather than empty.

Accept that some deliverable types will only ever get option 3, and design that card to be genuinely good rather than treating it as a failure state.

**Link rot is now a first-class risk.** A dead or permission-denied link is worse than no link — it's the exact moment the client's trust breaks. Required, not optional:

- **Access check before publish.** Nothing publishes with a link the client can't open. Prompt the sender to confirm sharing permissions; where the provider allows, verify programmatically.
- **Periodic link health checks** on published links, with a quiet internal alert on failure — never a client-facing broken link.
- **Owner and date on every link,** so a stale link has someone to chase.
- **Archive caveat.** §3a's "leaving you means losing an archive" is weaker when the archive is links to files you don't control. The closeout checklist should require that final links point at a **durable, client-owned or studio-owned location** — not someone's personal Drive.

**What this kills:** comments pinned to the design (§4, v2). You can't annotate an image you don't host, and Figma already does this natively and better. Point clients at Figma comments for spatial feedback; the portal owns the **decision** — approve / request changes — and the consolidated written feedback that accompanies it. Don't rebuild Figma.

---

## 4. Feature set

### Must-have (v1 — ship this first)
- **Client Workspace** — the account front door: multiple project cards, roll-up health, unified "Waiting on you," "Start a new project."
- **Account brand library** — persistent labelled **link index** to assets/deliverables, shared across all of a client's projects.
- **Project health status** with plain-English reasoning, set by the PM (assisted, not fully automated).
- **Milestone timeline** with a clear "current position" marker, using the per-engagement-type template.
- **"Waiting on you" action items** — client inputs/assets/decisions, with due dates and nudges, aggregated across projects at the workspace level.
- **Deliverables gallery** — concepts/mockups/prototypes as embedded or beautifully-carded links, with round history and one-click approval. For a design studio this is the emotional heart of the portal; see §3c on making links feel as good as previews.
- **Link integrity** — access-check before publish, periodic health checks, owner + date on every link. A broken link is a trust event, not a bug (§3c).
- **Consolidated feedback + revision-round counter** — all feedback on a deliverable in one place; "Round 1 of 2 included" visible to both sides (see §5).
- **Client input checklist** — item by item, the client supplies brand info and content as text, or **pastes a link** to their Drive folder/file, so nothing lives in email. Note the friction trade-off in §3c: pasting a link is a heavier ask than dragging a file, so keep the item count low and the instructions explicit.
- **Activity feed** in plain client language, written by the PM.
- **Notifications** — email digest + in-app, respecting a "no spam" cadence.
- **Secure access** with roles set **per project inside each account** (owner / reviewer / viewer), plus studio-side roles (§3b).
- **Internal lens** — the studio's own view of the project, default-private, with an explicit publish boundary (§3b).
- **SOP checklist templates + gated deliverables** — Super Admin authors per deliverable type; assignees tick with evidence; deliverables can't reach the client until required items pass (§5b).

### Must-have (internal side)
- **Lightweight tasks** — assignee, due date, status, linked to milestone/deliverable; a cross-project "My work" view (§5a).
- **Deliverable ownership** — drives who may tick checklist items.
- **Drafted client update** — composed from the week's real events by **deterministic rules, not a language model** (§6a), then edited and published by the PM. This is what keeps the portal never-stale.
- **People tagging: responsible party & blocker** — tag a teammate as owner of a task, or as the person blocking it. Creates a real, aging obligation, not a mention in a comment (§5a).
- **Standup mode** — a per-project walkthrough view for the team's standup, generated from existing data. The same session is where client updates get published (§5c).
- **Project closeout checklist** — the business-end SOP that gates DONE (§5b).
- **Mobile-first client experience** — designed at 375px before desktop, magic-link auth, one-thumb approval (§6b).

### Should-have (v2)
- **Approvals with audit trail** — who approved what, when (protects both sides in disputes).
- **Scope-change log** — every change request logged, its budget/time impact shown and acknowledged.
- **Budget/hours transparency** (gate behind a setting; not every client should see hours).
- ~~Comments pinned to the design~~ — **cut** (§3c). You can't annotate artwork you don't host, and Figma does this natively and better. Point clients at Figma comments for spatial feedback; the portal owns the **decision** (approve / request changes) and the consolidated written feedback attached to it.
- **Extra-revision request flow** — when a client wants a round beyond what's included, the portal shows the cost and logs their go-ahead.
- **Weekly summary** the PM edits and publishes in 2 minutes.
- ~~Mobile-responsive~~ — **promoted to v1 and reframed**: the client experience is *mobile-first*, not responsive-as-an-afterthought (§6b).

### Delight / differentiators (v3+)
- **Guided intake wizard** — a branded questionnaire at kickoff that collects brand inputs, goals, and assets in one sitting, replacing the messy back-and-forth brief. Doubles as a great first impression.
- **The handoff / delivery moment** — a polished "here's everything you now own" **delivery index** at project end: one beautifully-laid-out page of every final link — logo files, brand guidelines, exported assets, prototype — generated from the completed checklist (§5b). This is the mic-drop clients screenshot and refer you for.
- **A portal that looks *designed*** — as a studio selling taste, treat the portal as a portfolio piece: your typography, your motion, your polish. Most competitors' portals look like spreadsheets; yours shouldn't.
- **Client-side SLA meter** — gently visualize how the client's response time affects the delivery date (reframes delays as shared, not your fault).
- **Care-plan / retainer view** — for ongoing brand or website support: what's been done this month, hours used. Turns one-off projects into recurring revenue with visible value.
- **Digest email that reads like a human wrote it**, one-click deep-links back into the portal.

### Deliberately leave out (anti-features)
- Raw ticket boards, story points, sprint velocity charts (you don't use them — don't invent them for the client either).
- Fake/auto-calculated % complete based on time elapsed.
- Real-time chat that competes with your existing comms channel.
- Everything configurable — over-flexibility kills clarity. Opinionated defaults win.
- **On the internal side too:** story points, velocity, burndown charts, mandatory time tracking, nested subtasks, custom workflow states, automation builders. Every one of these is how a light PM layer becomes a heavy one the team quietly abandons.
- **Checklist rule engines.** Conditional logic beyond simple `applies when` tags. Authoring must stay a 5-minute job or SOPs won't get written.

---

## 5. The three secret-weapon mechanics

A design studio has **three** high-leverage mechanics. The first two flip friction from "the studio is slow" to "here's what shared progress needs." The third (§5b) protects quality and makes "done" provable.

**A. "Waiting on you" — client inputs and decisions.** The biggest slippage sources are missing brand inputs/assets and slow decisions.

- Every client action item has an owner name, a due date, and a visible impact ("Blocks: Logo concepts").
- Inputs are collected *in the portal*, item by item ("Link us to your current logo files," "Approve the moodboard direction"), not chased over email. Since the portal takes links rather than uploads (§3c), each item states exactly what's needed and where to put it — vagueness here costs you days.
- Overdue items escalate calmly: in-app badge → email nudge → flagged to their sponsor.
- Clearing an item gives a small, satisfying confirmation. Momentum is a feeling.

**B. Consolidated feedback + revision rounds — margin protection.** Scattered, contradictory feedback and endless "one more direction" are where studio profitability leaks.

- All feedback on a deliverable lands in one place; the client is nudged to consolidate stakeholders into a single voice before submitting.
- The revision counter is always visible: **"Round 1 of 2 included."**
- Requesting a round beyond the included scope shows the cost and requires a logged go-ahead — so extra work is always a conscious, billable, mutually-agreed decision.

Together these flip the emotional dynamic: instead of the client wondering why *you're* slow, the portal shows that progress is shared — and protects your margins by making every extra round a visible, agreed choice. Fewer defensive status calls, faster feedback loops, fewer scope disputes.

---

## 5a. The internal project-management layer

The goal is **the lightest PM layer that can generate a trustworthy client update.** Not Jira. If the internal side is heavier than what the team uses today, they will abandon it and the client side goes stale — a worse outcome than the manual-only version of this product.

**What's in it:**
- **Tasks** — title, assignee, due date, status (To do / In progress / Blocked / Done), linked to a milestone and (optionally) a deliverable. That's the whole schema.
- **Blocked-by** — a task can be blocked by another task *or by a client action item* from §5A. This is the join that makes "we're waiting on you" provably true rather than a claim.
- **Milestone view** — tasks grouped under the client-facing milestones from §3, so internal work and the client's mental model share one spine.
- **Deliverable ownership** — who is responsible for each deliverable. This drives who may tick its checklist (§5b).
- **My work** — a per-person view across all projects. This is the screen the team actually lives in; if it isn't good, nothing else matters.

**Tagging people — two kinds, and the difference matters.** Most tools have one @mention that means everything and therefore nothing. Split it:

| Tag | Meaning | Behavior |
|---|---|---|
| **Responsible** | This is yours to move | Appears in their *My work*; one responsible party per task, always a person, never a team |
| **Blocker** | I can't proceed until you do something | Appears in their **Blocking others** list with an aging clock, and marks the blocked task |
| *(mention)* | FYI / question | Notification only. No obligation, no clock |

Three rules keep this honest:

- **Blocking is directional and visible both ways.** "I'm blocked by @Ada" also shows on Ada's screen as "you're blocking Chike's icon set, 2 days." Nobody has to chase; the system does the awkward part.
- **"Blocking others" is its own screen.** Almost nobody builds this and everyone needs it — it's the single most useful thing a person can see about their own impact each morning.
- **A blocker can be a client.** Tagging the client-side action item from §5A as the blocker is what makes "we're waiting on you" provably true rather than a claim, and it feeds the SLA meter.

**Aging beats status.** Show time-in-state everywhere: how long a deliverable has sat in review, how long a blocker has been open, how long a client item has been outstanding. A status can be stale and still look fine; an age can't lie. Ages are also what let the health signal (§3) semi-calculate itself instead of relying on a PM's mood.

**What's deliberately out:** story points, sprint velocity, burndown charts, time tracking as a requirement, nested subtasks, custom workflow states, automations. The §4 anti-features list applies to the internal side too — the studio doesn't work this way, so don't invent it internally either.

**The auto-drafted update.** At publish time the system composes a draft from the week's real events: milestones reached, deliverables sent for review, approvals received, client items outstanding, tasks that slipped. The PM edits the prose and the health status, then publishes. This is the single highest-value thing the internal layer buys — everything else is bookkeeping.

**Retain the escape hatch.** Manual health-setting and manual updates never go away. If the team skips the internal layer for one messy project, the portal must still work exactly as it does in the client-only design. No feature may become load-bearing on internal discipline.

---

## 5b. Mechanic C — the SOP deliverables checklist

**The problem it solves:** "done" currently means whatever the person who did the work thinks it means. Icons ship without an SVG. A logo package goes out missing the monochrome variant. A site launches with no favicon. Every one of these is a small credibility leak and an unbillable rework loop.

**The core idea:** a **checklist item is not a tick-box — it's a slot that points at the work.** Since the portal stores no files (§3c), the slot holds a **link plus a short note**: "SVG icons exported" isn't a boolean, it's a link to the Drive folder or Figma page where they live. Three things fall out of that:

1. The completed checklist **is** the delivery manifest — a list of where everything actually is.
2. The v3 **delivery index** (§4) generates itself from the items marked *final deliverable*.
3. "Done" becomes **provable**, not asserted — someone had to point at the work, not just tick a box.

**Honest caveat:** a link is weaker evidence than a file. Nothing stops someone pasting a link to a folder that doesn't contain what the item claims. Two mitigations, both cheap: **countersigning** on the items that matter (a Lead opens the link and confirms), and the fact that the tick is attributed and permanent (§5b rules) — people are careful when their name is on it. Don't over-engineer past this; validating link *contents* is not worth building.

### Structure

**Templates (authored by Super Admin only).** Each **Project Type** already owns a milestone template (§3). It now also owns a set of **Deliverable Types**, and each Deliverable Type owns a **checklist template**:

- *Brand Identity* → Logo Package, Brand Guidelines, Icon Set, Social Kit
- *Product / UI Design* → Wireframe Set, UI Screens, Prototype, Design System, Dev Handoff
- *Website* → Sitemap, Page Designs, Built Site, Launch Package

A checklist item carries more than a label:

| Field | Purpose |
|---|---|
| **Label** | "Export SVG (optimized, outline strokes)" |
| **How-to note** | The SOP itself — the one-line standard, so the checklist teaches |
| **Required / optional** | Required items gate; optional ones don't |
| **Evidence type** | none / link / short text (no file uploads — §3c) |
| **Expected source** | Hint only: Figma / Drive / staging URL / Loom. Guides the person, doesn't hard-validate |
| **Is final deliverable** | If yes, this link appears in the client-facing delivery index at handoff |
| **Who may tick** | Assignee of the deliverable (default) or a specific role |
| **Needs countersign** | Whether a Lead must confirm (see below) |
| **Applies when** | Optional tag (e.g. `dark-mode`, `multi-language`) chosen at project setup |

**Example — Icon Set** (each item's evidence is a link to where the work lives):

| Item | Evidence | Flags |
|---|---|---|
| SVG set exported and optimized | Link to Drive folder | required · *final deliverable* |
| PNG set @1x/2x/3x | Link to Drive folder | required · *final deliverable* |
| Consistent grid & stroke weight | none | required |
| Named per convention | none | required |
| Dark-mode variants | Link | *applies when* `dark-mode` |
| Contrast checked | Short note | required · **countersign** |
| Source file archived to brand library | Link to Figma | required |
| Client sharing permissions verified | none | required — nothing publishes with a link they can't open (§3c) |

Keep templates to **7±3 required items.** Past ~10 they get rubber-stamped and the whole mechanism becomes theatre.

### The rules that make it an SOP rather than a to-do list

- **Snapshot, never reference.** When a deliverable is created it takes a *frozen copy* of the template at version N. A Super Admin editing the SOP tomorrow must never retroactively un-complete an in-flight project. Templates are versioned; every project records which version it shipped against.
- **Ticking is a signed event.** Who, when, on what evidence — immutable. Unticking doesn't erase; it writes a new event with a reason. This is what makes the checklist usable in a quality review or a scope dispute.
- **Attribution is enforced.** Only people assigned to the deliverable can tick its items. This is the user's core requirement: *the people who did the work attest to it.*
- **Separation of duties, selectively.** Items where self-certification is worthless — accessibility contrast, brand compliance, file naming, cross-browser — carry a **countersign** flag: a Lead must confirm. Blanket review of every item just relocates the rubber-stamping; apply it to a handful.
- **Waivers, not workarounds.** A PM can waive a required item, but must give a reason and it's logged and visible on the deliverable. A hard block with no valve gets routed around by people creating fake deliverables — which destroys the data.

### The gates

- **Deliverable → *In Review* (becomes client-visible):** all required items ticked, countersigns done, or waived-with-reason — **and the review link opens for the client's role.** The link check is the one gate with no override.
- **Milestone → complete:** all its deliverables at *Approved* or *Delivered*.
- **Project → DONE:** every deliverable delivered **plus** a **project closeout checklist** — its own SOP, covering the business end: delivery index published, final links pointing at a **durable, client-owned or studio-owned location** (not a personal Drive), source files archived to the account brand library, invoice raised, testimonial requested, case-study assets captured, access/credentials returned or revoked. This is where studios routinely leak money and marketing material.

Recommendation: gates **warn and require an override reason** rather than hard-block, everywhere except the client-visibility gate — nothing reaches the client's eyes without passing.

### Why this is strategically bigger than a QA feature

- **It's a quality feedback loop.** Which items fail or get waived most often tells you precisely where the process is weak. The SOP improves from its own telemetry.
- **It's onboarding.** A new designer's ramp becomes "follow the checklist." The how-to note on each item is the training material, embedded at the moment of use.
- **It's key-person risk insurance.** Studio standards stop living in one senior person's head. The template library becomes durable studio IP.
- **It's invisible to the client — by design.** No badge, no "passed our 9-point standard," no hint a checklist exists. The client experiences the *effect*: nothing half-finished, mislabelled, or broken-linked ever reaches them. Rigour that's felt rather than announced is the stronger version anyway, and it keeps clients from auditing your process.

---

## 5c. Standup mode — and the ritual that makes the whole product work

The team needs to run standup across several projects. Build for that directly, because it's the moment that solves the adoption problem in §7.

**The key move: standup is where publishing happens.** The team walks the projects, and the client updates fall out of the same session. Two rituals become one, and nobody writes a status update as a separate chore. If the portal is where standup happens, the portal is never stale — not through discipline, but because staleness would be visible to the whole team in the meeting.

**Standup mode is a view, not a data-entry form.** Everything in it already exists — tasks, blockers, ages, client items, deliverables in review. Nobody types their status twice. That's the difference between a tool people use and a tool people resent.

**The walkthrough.** A distraction-free, project-by-project view, arrow-key or swipe navigable, one project per screen:

- **Since last standup** — what actually changed (moved, completed, approved, slipped)
- **Blocked** — every blocked task with who's blocking and for how long, internal and client-side together
- **Due this week** — with anything already overdue pulled to the top
- **Waiting on the client** — aged, with the oldest first
- **Ready to publish** — the drafted client update, right there. Approve and publish without leaving standup.

**Person view, as a toggle.** Same data sliced by person instead of project — for when the question is "what is everyone on?" rather than "how is this project?" Includes each person's *Blocking others* count, which tends to resolve itself the moment it's visible to the room.

**Async check-in, for a distributed or busy week.** A prompt to each person; answers roll into the same standup view. Deliberately narrow: *what moved, what's blocking me, what I need from someone.* No "how are you feeling" fields, no streaks, no gamification.

**Keep out:** timers, round-robin speaking order, mood check-ins, attendance tracking, standup history analytics. This is a view that makes a 15-minute meeting sharper, not a meeting-management product.

---

## 6. Trust & tone details that matter

- **Honesty over green dashboards.** An "At risk" status shown early, with a plan, builds more trust than a green light that turns red overnight. Give the PM an easy way to say "at risk, here's why, here's the plan."
- **Plain language everywhere.** "We're exploring three logo directions for you to react to" beats "Iterating on visual identity concepts."
- **Presentation is the pitch.** For a studio that sells design, the portal's craft *is* the sell. Sloppy portal, sloppy studio — clients make that leap unconsciously.
- **Recency signals.** "Last updated 2 hours ago" reassures; a stale portal destroys trust faster than no portal.
- **No dead ends.** Every status has a next step or a "we've got it, nothing needed from you."
- **Set expectations on the empty state.** First login should teach: here's what this is, here's what you'll do here, here's how often it updates.

---

## 6a. Design direction — it must not look like an AI product

**This is not an AI product, and it must not read as one.** For a studio that sells taste, looking like a generated SaaS template is worse than looking plain — it signals you used a template for your own product, which is the exact opposite of the pitch in §6 ("presentation is the pitch").

There is now a house style that reads instantly as *machine-made*. Avoid all of it:

| Tell | Instead |
|---|---|
| Purple/indigo→blue gradients, glowing accents | A restrained palette drawn from Griida's actual brand |
| Inter / Geist everywhere at default weights | Real typographic choice — a face with a point of view, used at considered sizes |
| Sparkle ✨ icons, emoji section headers | Icons only where they aid scanning; no emoji in chrome |
| Glassmorphic frosted cards, heavy blur | Flat, confident surfaces with real hierarchy |
| Everything rounded to 12–16px, drop shadows everywhere | A single deliberate radius and shadow rule, used sparingly |
| Symmetrical three-column feature grids | Editorial, asymmetric layout — the kind a designer would actually set |
| Centered hero, gradient headline text | Content-led layout that starts with real information |
| A chat box as the primary interface | Direct manipulation. Nothing here is a conversation |
| Dark mode by default with neon accents | Light by default; dark as a genuine option, not an aesthetic |
| Abstract blob illustrations, generic 3D renders | Real content, real screenshots, real work — or nothing |

**Three positive directives:**

1. **Look like a studio's product, not a startup's dashboard.** The nearest reference is a well-set editorial or print system — generous type, real hierarchy, comfortable density — not a metrics dashboard. Clients should recognize Griida's hand in it.
2. **Content density over decoration.** Most SaaS-y emptiness comes from having little to say. This product has plenty to say — a milestone, a date, a name, a link. Set that information well and it carries the design; you don't need ornament.
3. **Motion is functional only.** Transitions that show where something came from, and nothing else. No ambient animation, no scroll-triggered reveals, no shimmer.

**And keep AI out of the build, not just the visuals.** The drafted client update (§5a) is **deterministic templating from logged events** — "3 tasks completed, 1 deliverable moved to review, 2 items waiting on you since Tuesday" — not a language model. That matters for three reasons: it can't fabricate anything about a client's project, it's free and instant, and it never needs the disclaimer-and-thumbs-up chrome that would make the portal look like everything else. If a generative feature is ever added, it should be invisible and optional, never the interface.

---

## 6b. Mobile-first — for clients, specifically

Clients read this on a phone, between meetings, standing up. **Design the client experience at 375px first and let the desktop version be the expansion** — not the other way round. The internal lens can be desktop-first, with two exceptions noted below.

**The mobile client home is the "waiting on you" list.** Not a dashboard, not a chart. The first screen answers: *is everything fine, and do you owe us anything?* Health, then obligations, then what's new. Everything else is a tap away.

**The core mobile flow, in one thumb:**

> Push/email notification → deep-link straight into the update → read it → open the review link → come back → **Approve** or **Request changes** → done.

Every step must work one-handed, with the primary action in the bottom third of the screen. Approval in particular should never require a scroll-and-hunt.

**Magic-link auth, not passwords.** Nobody types a password on a phone between meetings. Email a link that logs them straight into the item in question. This is also the single biggest lever on login rates — a password reset is where client engagement goes to die.

**The honest tension: design review needs a big screen.** A client can't meaningfully evaluate a brand system or a prototype on a phone, and pretending otherwise produces shallow approvals and later regret. So split the intent:

- **Triage on mobile** — see status, read the update, clear a simple input item, acknowledge, leave a quick comment, approve *low-stakes* items.
- **Nudge to desktop for real review.** When a deliverable is flagged as needing considered review, mobile offers **"Save for desktop"** — which sends them a reminder link — rather than an approve button. Withholding the approve button on the phone for high-stakes items protects the studio from an approval the client will walk back.
- **Know the target.** Figma prototypes and Drive previews are rough in mobile browsers. Say so plainly in the link card — "best viewed on desktop" — rather than letting the client discover it.

**Two internal screens must be mobile-good too:** *My work* (checked on the way in) and *standup mode* (§5c — someone will run it from a phone). Everything else internal can assume a laptop.

---

## 7. Adoption strategy (internal — the real risk)

The portal dies if updating it feels like a chore. With the internal layer added, the risk **moves** rather than disappears: it's no longer "will the PM write updates?" but **"will the team actually work inside this?"** If they don't, you lose both sides at once. Protect adoption:

1. **Attach publishing to standup, not to willpower.** §5c is the answer to this section: the team already meets to walk the projects, and the drafted client update is sitting right there in the walkthrough. Publish during the meeting. A ritual that rides on an existing habit survives; a standalone "remember to update the portal" habit does not.
2. **The internal layer must be lighter than what the team uses today.** Judge it on one screen: "My work." If a designer wouldn't voluntarily open it each morning, the feature has failed regardless of what else is built.
3. **Roll out the SOP checklists on one deliverable type first.** Author the icon-set or logo-package checklist, run it on live projects for a month, and let the team edit the wording until it reflects how they actually work. SOPs written top-down in one sitting get ignored; SOPs the team helped word get followed.
4. **Watch the waiver rate.** Items waived on most projects are wrong items — cut them. This is the mechanism that keeps checklists honest and short.
5. **Update at natural checkpoints, not constantly.** Design projects move in phases — refresh the portal when a concept ships, when feedback is in, when you're waiting on the client. You don't need daily updates; you need *never-stale* ones.
6. **Kill the status-email.** Once the portal exists, all status flows through it — clients are trained to check it, and the team is freed from writing update emails.
7. **Build vs. buy — re-open this, but it just got cheaper.** The no-file-storage constraint (§3c) removes uploads, storage cost, virus scanning, and most of the security surface — this is now a **links, status and events** application, which is a much smaller build. Still, signed checklist events, versioned SOP templates and role-gated publishing are a real data model, not a WordPress members area. Either accept a proper app stack, or deliberately ship Phase 1 client-side on WordPress and treat the internal layer as a separate decision once clients have proven they use the portal at all. Lead with brandability either way.
8. **Measure it.** Track client logins, input-checklist completion speed, feedback/approval turnaround, and number of "what's the status?" emails (should drop to near zero).

---

## 8. Suggested build sequence

- **Phase 1 (MVP):** Client Workspace (multi-project cards + roll-up health + unified "Waiting on you") → Project Home + health status + per-type milestone timeline + input checklist + deliverables gallery with one-click approval + consolidated feedback + revision-round counter + account brand library + notifications. Manually updated by PM, and *visually polished* from day one. Even a single-project client should sit inside the workspace shell so the structure is right from the start. Prove clients use it.
  In parallel, the **thinnest internal slice that pays for itself**: deliverable ownership + SOP checklists on **two** deliverable types + the client-visibility gate. Checklists deliver value on day one without any task management existing yet — they're the cheapest high-value part of this whole expansion.
  Client-side is **mobile-first from the first wireframe** (§6b), with magic-link auth and one-thumb approval. Add the **decision log** and **create-project-from-type** (§10.1, §10.2) — both are small and both change how much the rest gets used.
- **Phase 2:** The internal PM layer proper — tasks, "My work," responsible/blocker tagging with aging (§5a), **standup mode** (§5c), the drafted client update, full checklist template library, project closeout checklist. Plus: approvals audit trail, extra-revision request flow, scope-change log, guided intake wizard, per-project roles, reply-by-email, "seen by," auto-nudges.
  Sequence note: build **tagging and aging before standup mode** — standup is a view over that data and has nothing to show without it.
- **Phase 3:** Auto-generated **delivery index** from checklist links, checklist telemetry (failure/waiver rates feeding SOP improvement), periodic link-health monitoring across archived projects, estimate-vs-actual learning, capacity view, studio-side digest, case-study capture. Plus recurring-client depth — "Start a new project" pre-fill, relationship/history view, care-plan/retainer view; plus client SLA meter and the handoff/delivery bundle.

Ship Phase 1 to one or two friendly clients, watch what they actually click, and let real behavior — not this document — drive Phase 2.

---

## 9. Success metrics

- ↓ inbound "what's the status?" messages
- ↓ time to collect inputs/assets from the client (a top slippage source)
- ↓ average feedback/approval turnaround time
- ↓ unbilled "extra" revision rounds (margin protection working)
- ↑ portal logins per client per week
- ↑ on-time delivery rate (as client-side latency drops)
- ↑ repeat-engagement rate / projects per account (the recurring-client flywheel working)
- Qualitative: clients cite the portal as a reason they'd refer you or come back

**Internal / SOP metrics:**
- ↓ **post-delivery rework** — deliverables re-opened after being sent (the number the checklist exists to move)
- ↑ **first-pass rate** — deliverables that clear their checklist without an item being reverted
- ↓ **waiver rate** — required items waived rather than met (rising waivers = wrong SOP, not a lazy team)
- **Failure heatmap** — which items fail most often, per deliverable type; this is the input to improving the SOP
- **Broken or permission-denied links reaching a client — target zero.** The single most damaging failure mode of a link-based portal (§3c)
- ↓ **time-to-publish** — minutes from opening the portal to a published client update (target: under 2)
- ↑ **team weekly active use** of the internal lens (if this is low, treat everything else as at risk)
- ↓ **ramp time for a new designer** to ship an unassisted deliverable
- ↑ **share of standups run inside the portal** — the leading indicator for everything else in §7
- ↓ **average blocker age**, and ↓ **blockers older than 3 days** — what the tagging model exists to move
- **% of client sessions on mobile** — validates the §6b bet; if it's high, keep investing there
- ↑ **approval completion rate from a notification** — did the deep-link-to-approve flow actually work one-handed?

---

## 10. Further value opportunities

Ranked by value-to-effort. The top three are cheap and disproportionately useful.

**1. Decision log.** A running record of decisions: *"Going with direction B — agreed with Tunde, 12 May."* Design work is a chain of decisions, and the most expensive conversation in any studio is "I thought we agreed…". One line, a date, a name, client-visible. Nearly free to build, and it ends that conversation permanently. It also gives the extra-revision flow (§5) its evidence: you can point at the moment a direction was chosen.

**2. Projects are created from a type, with everything attached.** Choosing "Brand Identity" at kickoff instantiates the milestone template, the deliverable list, and their SOP checklists in one action. This is what makes the SOP the **default path rather than extra work** — the single biggest determinant of whether §5b gets used at all. If a PM has to attach checklists manually, they won't.

**3. Reply-by-email.** Clients live in email, not in your portal. Let them reply to a notification and have it land as portal feedback. This removes the one real reason a client abandons a portal — that it's another place to check — while keeping every conversation in one system of record. Pairs naturally with the mobile-first thinking in §6b.

**4. "Seen by" on published updates.** Did the client actually open it? Answers the question without the awkward "did you get a chance to look?" message, and quietly protects you in a dispute about what was communicated. Show it internally only.

**5. Calm auto-nudges on overdue client items.** The portal chases, not a person. This removes real emotional labour — nobody enjoys sending the fourth reminder — and depersonalizes the chase so the relationship stays warm. Escalation ladder already sketched in §5A; make it automatic.

**6. Estimate vs. actual, learned per project type.** When a milestone date slips, ask once, log the reason, move on. After a dozen projects you know your real velocity for a brand identity versus a website, and *why* things slip — client latency, scope creep, capacity. This turns the portal into the thing that makes your quoting accurate, which is worth more than any client-facing feature.

**7. Search across everything.** A link registry becomes worthless the moment nobody can find the link. Search across projects, deliverables, links, decisions, and updates. Unglamorous; load-bearing.

**8. Light capacity view.** Count of open tasks and blockers per person across all projects. Enough to notice someone is drowning or that the studio is about to over-commit on a new job. Resist anything resembling resource planning or utilization targets — that's a different, worse product.

**9. Studio-side weekly digest.** The client digest exists; the owner needs one too. Every project's health, aging blockers, overdue client items, revision rounds burned. The one email that tells you where the studio actually stands.

**10. Case-study capture at closeout.** The closeout checklist (§5b) already asks for case-study assets. Make it a real capture — the problem, the approach, the outcome, the links, a client quote requested while goodwill is highest. Studios chronically fail to document their own work, then struggle to fill their portfolio. The portal is holding all of it already.

---

## 11. Open questions to resolve before design

1. **Does the internal layer replace the studio's current tool, or coexist?** Coexisting means double entry, which kills adoption. Replacing means the internal layer must be good enough on day one. This is the single biggest decision in the expansion.
2. **How strict is the DONE gate?** Recommendation in §5b is override-with-reason everywhere except client visibility — confirm that's acceptable.
3. **Do checklists attach only to deliverables, or also to milestones** (a "definition of ready/done" per phase)? Deliverable-only is simpler and covers ~80% of the value; start there.
4. ~~Do clients ever see checklist detail?~~ **Resolved: never.** Not the items, not a badge, not the fact that checklists exist. Clients see the timeline, published updates with review/document links, and the review action (§3b).
5. **Who authors the first templates, and when?** SOPs written but never used are worse than none. Tie template authoring to a specific live project.
6. **Where do "final" links live so they survive?** Personal Drives and expiring share links break the archive value in §3a. Decide the canonical durable location — a studio-owned Drive with the client granted access, a client-owned folder, or both — before the first closeout checklist is written.
7. **Do you embed or card?** Embedding Figma/Drive inside the portal is the difference between a link list and something that feels designed (§3c). Worth prototyping early, since it shapes the entire deliverable UI.
8. **How often does standup actually run,** and is it live or async? Daily-live and weekly-async produce meaningfully different views. Build for the cadence the team already keeps rather than the one you'd like them to keep.
9. **Which deliverables are "high-stakes"** and therefore can't be approved from a phone (§6b)? Probably direction-setting ones — concepts, final identity, launch sign-off. Needs to be a per-deliverable-type setting, decided with the SOP templates.
10. **What is the typographic and color direction?** §6a says what to avoid; someone still has to make the positive choice. This should be a deliberate design exercise up front, not something settled by whatever the component library ships with — that's precisely how products end up looking generated.

---

**Technical design:** see `Architecture-and-Schema.md` — stack, RLS-enforced publish boundary, full Postgres schema, state machines and gate logic, and brand tokens derived from the logo.

*Next step: turn Phase 1 into wireframes or a clickable prototype, and pressure-test three flows on one real live project — the client input checklist, the revision-round counter, and one SOP deliverable checklist end-to-end (author → tick with a link → countersign → access-check → gate → the client sees only a timeline entry with a working review link).*
