/**
 * Client-lens domain types.
 *
 * These mirror the Phase 1 subset of Architecture-and-Schema.md §3, but shaped
 * for *reading*: only what a client is allowed to see (§3b — timeline, updates
 * with links, and the review action). Nothing here has a field for tasks,
 * checklists, evidence or internal notes, so those cannot leak by accident.
 */
import type { DeliverableStatus, Health } from "./copy.ts";

export type { DeliverableStatus, Health };

/** Everything is a link — the portal stores no files (§3c). */
export interface Link {
  id: string;
  url: string;
  label: string;
  provider: "figma" | "drive" | "staging" | "loom" | "other";
  /** Verified as openable by this client before publish. §5b's one hard gate. */
  clientAccessOk: boolean;
  /** Rough is fine — used to warn "best viewed on desktop" (§6b). */
  bestOnDesktop: boolean;
}

export interface MilestoneView {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "complete";
  targetDate: string | null;
  completedAt: string | null;
}

export interface DeliverableView {
  id: string;
  name: string;
  typeName: string;
  status: DeliverableStatus;
  round: number;
  roundsIncluded: number;
  /** High-stakes work cannot be approved from a phone (§6b). */
  requiresConsideredReview: boolean;
  reviewLink: Link | null;
  updatedAt: string;
  summary: string | null;
}

export interface ClientActionView {
  id: string;
  projectId: string;
  projectSlug: string;
  projectName: string;
  title: string;
  description: string | null;
  /** What this is holding up — stated without blame (§5A). */
  blocks: string | null;
  dueOn: string | null;
  status: "open" | "submitted" | "accepted";
  createdAt: string;
}

export interface UpdateView {
  id: string;
  body: string;
  publishedAt: string;
  author: string;
  reviewDeliverableId: string | null;
  documentLink: Link | null;
}

export interface DecisionView {
  id: string;
  summary: string;
  decidedOn: string;
  decidedBy: string;
}

export interface ProjectView {
  id: string;
  slug: string;
  name: string;
  typeName: string;
  health: Health;
  healthNote: string | null;
  targetEndOn: string | null;
  roundsIncluded: number;
  lastUpdatedAt: string;
  milestones: MilestoneView[];
  deliverables: DeliverableView[];
  updates: UpdateView[];
  decisions: DecisionView[];
  documents: Link[];
}

export interface WorkspaceView {
  accountId: string;
  accountName: string;
  contactFirstName: string;
  projects: ProjectView[];
  /** Aggregated across every project — one list, not three (§3). */
  waitingOnYou: ClientActionView[];
  brandLibrary: Link[];
}
