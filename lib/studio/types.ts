/**
 * Studio-lens domain types — the internal half of the product.
 *
 * These describe work the client must never see (Architecture-and-Schema.md
 * §3b): tasks, who is blocking whom, checklist evidence, waivers, draft
 * updates. Nothing in this file is ever rendered inside the client route
 * group, and nothing in `lib/types.ts` reaches into this one.
 */

export type StudioRole = "super_admin" | "admin_pm" | "lead" | "member";

export interface Person {
  id: string;
  name: string;
  initials: string;
  role: StudioRole;
}

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

/**
 * The three-way tag from §5a. One @mention that means everything means
 * nothing, so the distinction is structural rather than a convention:
 *
 *   responsible — yours to move. Exactly one person, never a team.
 *   blocker     — I can't proceed until you do something. Carries a clock.
 *   mention     — FYI. No obligation, no clock. (Notification only; not here.)
 */
export interface Blocker {
  id: string;
  kind: "person" | "task" | "client";
  /** Whoever is being waited on — a teammate, or the client. */
  blockedByPersonId?: string;
  blockedByTaskId?: string;
  /** The client action this is waiting on, so "waiting on you" is provable. */
  clientActionId?: string;
  note: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  responsibleId: string | null;
  status: TaskStatus;
  dueOn: string | null;
  deliverableId: string | null;
  stateChangedAt: string;
  blockers: Blocker[];
}

/* -------------------------------------------------------------------------- */
/* SOP checklists (§5b)                                                       */
/* -------------------------------------------------------------------------- */

export type EvidenceKind = "none" | "link" | "text";
export type ItemState = "open" | "checked" | "countersigned" | "waived";

export interface ChecklistItem {
  id: string;
  position: number;
  /** Copied from the template at instantiation. Never joined back. */
  label: string;
  guidance: string | null;
  isRequired: boolean;
  evidenceKind: EvidenceKind;
  expectedSource: string | null;
  requiresCountersign: boolean;
  isFinalDeliverable: boolean;
  state: ItemState;
  /** Who attested, and when. Immutable once written. */
  checkedById: string | null;
  checkedAt: string | null;
  countersignedById: string | null;
  evidenceUrl: string | null;
  evidenceText: string | null;
  waivedReason: string | null;
}

export interface Checklist {
  deliverableId: string;
  templateName: string;
  /** Which SOP version this shipped against — provenance, not a live link. */
  templateVersion: number;
  items: ChecklistItem[];
}

/* -------------------------------------------------------------------------- */
/* Internal project view                                                      */
/* -------------------------------------------------------------------------- */

export interface StudioDeliverable {
  id: string;
  name: string;
  typeName: string;
  status: "draft" | "in_review" | "changes_requested" | "approved" | "delivered";
  ownerId: string | null;
  round: number;
  roundsIncluded: number;
  stateChangedAt: string;
  reviewUrl: string | null;
  /** The one gate with no override — verified viewable by the client (§5b). */
  linkAccessOk: boolean | null;
  checklist: Checklist | null;
}

export interface StudioProject {
  id: string;
  slug: string;
  name: string;
  clientName: string;
  typeName: string;
  health: "on_track" | "at_risk" | "blocked";
  healthNote: string | null;
  targetEndOn: string | null;
  leadId: string;
  lastPublishedAt: string | null;
  tasks: Task[];
  deliverables: StudioDeliverable[];
  /** Client-side items, mirrored here so blockers can point at them. */
  clientActions: { id: string; title: string; dueOn: string | null; createdAt: string }[];
}

export interface Studio {
  people: Person[];
  projects: StudioProject[];
  /** Who is "signed in" — until auth lands. */
  currentPersonId: string;
}
