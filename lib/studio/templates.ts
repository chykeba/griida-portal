/**
 * Project types and the SOP templates hanging off them.
 *
 * This is the studio's IP: the milestone spine for each engagement type, the
 * deliverables it produces, and the checklist that defines "done" for each.
 * Authored by super admins only (§3b) — centralised so the SOP means something.
 */
import type { Checklist, ChecklistItem, EvidenceKind } from "./types.ts";

export interface ChecklistTemplateItem {
  label: string;
  guidance?: string;
  isRequired?: boolean;
  evidenceKind?: EvidenceKind;
  expectedSource?: string;
  requiresCountersign?: boolean;
  isFinalDeliverable?: boolean;
  /** Only instantiated when the project carries this tag. */
  appliesWhen?: string;
}

export interface DeliverableTypeTemplate {
  id: string;
  name: string;
  requiresConsideredReview?: boolean;
  checklist?: { name: string; version: number; items: ChecklistTemplateItem[] };
}

export interface ProjectTypeTemplate {
  id: string;
  name: string;
  /** Tags a PM can switch on at kickoff, gating conditional checklist items. */
  tags: string[];
  milestones: string[];
  deliverables: DeliverableTypeTemplate[];
}

/** Items every deliverable checklist ends with, whatever the type. */
const ALWAYS: ChecklistTemplateItem[] = [
  {
    label: "Source file archived to the brand library",
    evidenceKind: "link",
    expectedSource: "Figma",
  },
  {
    label: "Client sharing permissions verified",
    guidance: "Nothing publishes with a link they can’t open.",
  },
];

export const PROJECT_TYPES: ProjectTypeTemplate[] = [
  {
    id: "pt_brand",
    name: "Brand identity",
    tags: ["dark-mode", "multi-language"],
    milestones: ["Discovery", "Moodboard", "Concepts", "Refinement", "Final assets"],
    deliverables: [
      {
        id: "dt_moodboard",
        name: "Direction & moodboard",
        checklist: {
          name: "Moodboard",
          version: 1,
          items: [
            { label: "Three distinct territories, not three versions of one" },
            { label: "References credited and licensed" },
            ...ALWAYS,
          ],
        },
      },
      {
        id: "dt_concepts",
        name: "Logo concepts",
        requiresConsideredReview: true,
        checklist: {
          name: "Logo concepts",
          version: 3,
          items: [
            { label: "Works at 24px and at poster size" },
            { label: "Monochrome version holds up", requiresCountersign: true },
            { label: "No unlicensed type in the wordmark", requiresCountersign: true },
            { label: "Dark-surface variant", appliesWhen: "dark-mode" },
            ...ALWAYS,
          ],
        },
      },
      {
        id: "dt_iconset",
        name: "Icon set",
        checklist: {
          name: "Icon set",
          version: 2,
          items: [
            {
              label: "SVG set exported and optimised",
              guidance: "Outline strokes, strip metadata, 24px artboard.",
              evidenceKind: "link",
              expectedSource: "Drive",
              isFinalDeliverable: true,
            },
            {
              label: "PNG set @1x/2x/3x",
              evidenceKind: "link",
              expectedSource: "Drive",
              isFinalDeliverable: true,
            },
            { label: "Consistent grid and stroke weight" },
            { label: "Named per convention", guidance: "kebab-case, category prefix." },
            {
              label: "Contrast checked",
              guidance: "Against both surfaces. Self-certification isn’t enough here.",
              evidenceKind: "text",
              requiresCountersign: true,
            },
            { label: "Dark-mode variants", appliesWhen: "dark-mode" },
            ...ALWAYS,
          ],
        },
      },
      {
        id: "dt_guidelines",
        name: "Brand guidelines",
        requiresConsideredReview: true,
        checklist: {
          name: "Brand guidelines",
          version: 1,
          items: [
            { label: "Covers logo, type, colour, spacing, misuse" },
            { label: "Colour values given in hex, RGB and CMYK" },
            { label: "Accessible colour pairings documented", requiresCountersign: true },
            {
              label: "Exported as PDF",
              evidenceKind: "link",
              expectedSource: "Drive",
              isFinalDeliverable: true,
            },
            ...ALWAYS,
          ],
        },
      },
    ],
  },

  {
    id: "pt_product",
    name: "Product / UI design",
    tags: ["dark-mode", "multi-language"],
    milestones: ["Research", "Wireframes", "UI design", "Prototype", "Handoff"],
    deliverables: [
      { id: "dt_wireframes", name: "Wireframe set" },
      {
        id: "dt_screens",
        name: "UI screens",
        requiresConsideredReview: true,
        checklist: {
          name: "UI screens",
          version: 2,
          items: [
            { label: "Empty, loading and error states drawn" },
            { label: "Contrast meets AA", requiresCountersign: true },
            { label: "Touch targets at least 44px" },
            { label: "Dark theme", appliesWhen: "dark-mode" },
            { label: "Copy proofread", guidance: "Real copy, not lorem." },
            ...ALWAYS,
          ],
        },
      },
      { id: "dt_prototype", name: "Prototype" },
      {
        id: "dt_handoff",
        name: "Dev handoff",
        checklist: {
          name: "Dev handoff",
          version: 1,
          items: [
            { label: "Tokens exported", evidenceKind: "link", isFinalDeliverable: true },
            { label: "Components named to match the codebase" },
            { label: "Walkthrough recorded", evidenceKind: "link", expectedSource: "Loom" },
            ...ALWAYS,
          ],
        },
      },
    ],
  },

  {
    id: "pt_website",
    name: "Website",
    tags: ["multi-language", "ecommerce"],
    milestones: ["Kickoff", "Design", "Content", "Build", "Review", "Launch"],
    deliverables: [
      { id: "dt_sitemap", name: "Sitemap" },
      { id: "dt_pages", name: "Page designs", requiresConsideredReview: true },
      {
        id: "dt_built",
        name: "Built site",
        checklist: {
          name: "Built site",
          version: 4,
          items: [
            { label: "Responsive from 320px up" },
            { label: "Lighthouse pass", evidenceKind: "text", requiresCountersign: true },
            { label: "Forms tested end to end" },
            { label: "Analytics installed and firing" },
            { label: "Favicon and social preview set" },
            { label: "Redirects mapped from the old site" },
            { label: "Language switcher tested", appliesWhen: "multi-language" },
            { label: "Checkout tested with a live card", appliesWhen: "ecommerce" },
            ...ALWAYS,
          ],
        },
      },
    ],
  },
];

export function findProjectType(id: string): ProjectTypeTemplate | undefined {
  return PROJECT_TYPES.find((t) => t.id === id);
}

/* -------------------------------------------------------------------------- */
/* Instantiation (§10.2)                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Turns a template into a live checklist.
 *
 * A **snapshot**, not a reference (§5b, §2.4). The instance copies every field
 * it needs, so a super admin editing the SOP tomorrow can never retroactively
 * un-complete a project already in flight. `templateVersion` records what it
 * shipped against, for provenance only.
 *
 * Conditional items are resolved here, once, against the project's tags —
 * rather than being carried around and evaluated at read time.
 */
export function instantiateChecklist(
  deliverableId: string,
  template: NonNullable<DeliverableTypeTemplate["checklist"]>,
  projectTags: string[],
): Checklist {
  const items: ChecklistItem[] = template.items
    .filter((i) => !i.appliesWhen || projectTags.includes(i.appliesWhen))
    .map((i, index) => ({
      id: `${deliverableId}_i${index + 1}`,
      position: index + 1,
      label: i.label,
      guidance: i.guidance ?? null,
      isRequired: i.isRequired ?? true,
      evidenceKind: i.evidenceKind ?? "none",
      expectedSource: i.expectedSource ?? null,
      requiresCountersign: i.requiresCountersign ?? false,
      isFinalDeliverable: i.isFinalDeliverable ?? false,
      state: "open",
      checkedById: null,
      checkedAt: null,
      countersignedById: null,
      evidenceUrl: null,
      evidenceText: null,
      waivedReason: null,
    }));

  return {
    deliverableId,
    templateName: template.name,
    templateVersion: template.version,
    items,
  };
}
