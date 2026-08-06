/**
 * Demo workspace.
 *
 * Real-shaped content so the design is judged against real sentence lengths and
 * real edge cases — an overdue item, a project that’s blocked, a deliverable on
 * its last included round, a link that needs a desktop.
 *
 * Dates are generated relative to today so the natural-language layer is always
 * exercised across its whole range (today / this week / this month / next month).
 */
import type { WorkspaceView } from "../types.ts";

const day = 86_400_000;
const now = Date.now();
const iso = (offsetDays: number) => new Date(now + offsetDays * day).toISOString();
/**
 * The Nth of the current month if it’s still ahead of us, otherwise the Nth of
 * next month. Keeps the demo showing live "the Nth of this month" phrasing
 * rather than silently drifting into "12 days late" as the month wears on.
 */
const dayThisMonth = (n: number) => {
  const d = new Date();
  const thisMonth = new Date(d.getFullYear(), d.getMonth(), n, 12);
  if (thisMonth.getTime() > d.getTime()) return thisMonth.toISOString();
  return new Date(d.getFullYear(), d.getMonth() + 1, n, 12).toISOString();
};
const dayNextMonth = (n: number) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, n, 12).toISOString();
};

export const demoWorkspace: WorkspaceView = {
  accountId: "acc_ovi",
  accountName: "Ovis Health",
  contactFirstName: "Tunde",

  waitingOnYou: [
    {
      id: "ca_1",
      projectId: "prj_brand",
      projectSlug: "brand-identity",
      projectName: "Brand Identity",
      title: "Pick a direction from the three concepts",
      description:
        "You don’t need to love everything about one — just tell us which feels closest and we’ll take it from there.",
      blocks: "refining the identity",
      dueOn: iso(-2),
      status: "open",
      createdAt: iso(-9),
    },
    {
      id: "ca_2",
      projectId: "prj_site",
      projectSlug: "website",
      projectName: "Website",
      title: "Send us the team photos",
      description:
        "Headshots for the eight people on the About page. A Drive link is perfect — they don’t need to be edited.",
      blocks: "building the About page",
      dueOn: dayThisMonth(17),
      status: "open",
      createdAt: iso(-3),
    },
    {
      id: "ca_3",
      projectId: "prj_site",
      projectSlug: "website",
      projectName: "Website",
      title: "Confirm the pricing copy",
      description: "Final wording for the three plan cards.",
      blocks: null,
      dueOn: dayNextMonth(4),
      status: "open",
      createdAt: iso(-1),
    },
  ],

  brandLibrary: [
    {
      id: "lnk_bl1",
      url: "https://drive.google.com/drive/folders/ovis-brand",
      label: "Brand assets (master folder)",
      provider: "drive",
      clientAccessOk: true,
      bestOnDesktop: false,
    },
    {
      id: "lnk_bl2",
      url: "https://www.figma.com/file/ovis-identity",
      label: "Identity working file",
      provider: "figma",
      clientAccessOk: true,
      bestOnDesktop: true,
    },
  ],

  projects: [
    {
      id: "prj_brand",
      slug: "brand-identity",
      name: "Brand Identity",
      typeName: "Brand identity",
      health: "blocked",
      healthNote: "We’re holding until you pick a direction.",
      targetEndOn: dayNextMonth(12),
      roundsIncluded: 2,
      lastUpdatedAt: iso(-0.1),
      milestones: [
        { id: "m1", name: "Discovery", status: "complete", targetDate: iso(-30), completedAt: iso(-28) },
        { id: "m2", name: "Moodboard", status: "complete", targetDate: iso(-18), completedAt: iso(-17) },
        { id: "m3", name: "Concepts", status: "in_progress", targetDate: dayThisMonth(17), completedAt: null },
        { id: "m4", name: "Refinement", status: "not_started", targetDate: dayNextMonth(2), completedAt: null },
        { id: "m5", name: "Final assets", status: "not_started", targetDate: dayNextMonth(12), completedAt: null },
      ],
      deliverables: [
        {
          id: "dlv_concepts",
          name: "Three logo directions",
          typeName: "Logo concepts",
          status: "in_review",
          dueOn: dayThisMonth(17),
          round: 1,
          roundsIncluded: 2,
          requiresConsideredReview: true,
          reviewLink: {
            id: "lnk_1",
            url: "https://www.figma.com/proto/ovis-concepts",
            label: "Three directions in Figma",
            provider: "figma",
            clientAccessOk: true,
            bestOnDesktop: true,
          },
          updatedAt: iso(-9),
          summary:
            "Three genuinely different routes rather than three versions of one idea. We’ve a favourite, but we’d rather hear yours first.",
        },
        {
          id: "dlv_moodboard",
          name: "Direction & moodboard",
          typeName: "Moodboard",
          status: "approved",
          dueOn: dayNextMonth(2),
          round: 1,
          roundsIncluded: 2,
          requiresConsideredReview: false,
          reviewLink: {
            id: "lnk_2",
            url: "https://www.figma.com/file/ovis-moodboard",
            label: "Moodboard",
            provider: "figma",
            clientAccessOk: true,
            bestOnDesktop: false,
          },
          updatedAt: iso(-17),
          summary: null,
        },
      ],
      updates: [
        {
          id: "upd_1",
          body: "Three directions are up and ready for you. They’re deliberately far apart — we’d rather find the right territory now than polish the wrong one later. Have a look when you get a proper moment at a desk, and tell us which one feels most like Ovis.",
          publishedAt: iso(-9),
          author: "Chike",
          reviewDeliverableId: "dlv_concepts",
          documentLink: null,
        },
        {
          id: "upd_2",
          body: "Moodboard’s signed off — thank you. We’re starting on concepts today and expect to have three routes with you by the end of next week.",
          publishedAt: iso(-17),
          author: "Chike",
          reviewDeliverableId: null,
          documentLink: null,
        },
      ],
      decisions: [
        {
          id: "dec_1",
          summary: "Going warm and editorial rather than clinical — no blues, no crosses.",
          decidedOn: iso(-17),
          decidedBy: "Tunde",
        },
        {
          id: "dec_2",
          summary: "Wordmark first. A symbol only if it earns its place.",
          decidedOn: iso(-24),
          decidedBy: "Tunde and Chike",
        },
      ],
      documents: [
        {
          id: "lnk_doc1",
          url: "https://drive.google.com/file/ovis-sow",
          label: "Statement of work",
          provider: "drive",
          clientAccessOk: true,
          bestOnDesktop: false,
        },
      ],
    },

    {
      id: "prj_site",
      slug: "website",
      name: "Website",
      typeName: "Website",
      health: "on_track",
      healthNote: "Design’s done. We’re building.",
      targetEndOn: dayNextMonth(28),
      roundsIncluded: 2,
      lastUpdatedAt: iso(-2),
      milestones: [
        { id: "m6", name: "Kickoff", status: "complete", targetDate: iso(-40), completedAt: iso(-40) },
        { id: "m7", name: "Design", status: "complete", targetDate: iso(-12), completedAt: iso(-10) },
        { id: "m8", name: "Content", status: "in_progress", targetDate: dayThisMonth(17), completedAt: null },
        { id: "m9", name: "Build", status: "in_progress", targetDate: dayNextMonth(14), completedAt: null },
        { id: "m10", name: "Launch", status: "not_started", targetDate: dayNextMonth(28), completedAt: null },
      ],
      deliverables: [
        {
          id: "dlv_pages",
          name: "Page designs",
          typeName: "Page designs",
          status: "changes_requested",
          dueOn: dayThisMonth(24),
          round: 2,
          roundsIncluded: 2,
          requiresConsideredReview: true,
          reviewLink: {
            id: "lnk_3",
            url: "https://www.figma.com/file/ovis-pages",
            label: "All eleven pages",
            provider: "figma",
            clientAccessOk: true,
            bestOnDesktop: true,
          },
          updatedAt: iso(-2),
          summary: "Your notes on the pricing page are in — we’re reworking that section now.",
        },
        {
          id: "dlv_staging",
          name: "Staging site",
          typeName: "Built site",
          status: "draft",
          dueOn: dayNextMonth(12),
          round: 1,
          roundsIncluded: 2,
          requiresConsideredReview: false,
          reviewLink: null,
          updatedAt: iso(-2),
          summary: "About half the pages are built. Nothing worth looking at yet — we’ll tell you when there is.",
        },
      ],
      updates: [
        {
          id: "upd_3",
          body: "Pricing page notes are in and they’re good ones — the three-column layout was doing too much. We’re reworking it and we’ll have it back to you this week. Everything else is signed off and building.",
          publishedAt: iso(-2),
          author: "Chike",
          reviewDeliverableId: "dlv_pages",
          documentLink: null,
        },
      ],
      decisions: [
        {
          id: "dec_3",
          summary: "Eleven pages at launch. The careers section waits for phase two.",
          decidedOn: iso(-12),
          decidedBy: "Tunde",
        },
      ],
      documents: [
        {
          id: "lnk_doc2",
          url: "https://drive.google.com/file/ovis-proposal",
          label: "Proposal & scope",
          provider: "drive",
          clientAccessOk: true,
          bestOnDesktop: false,
        },
      ],
    },
  ],
};
