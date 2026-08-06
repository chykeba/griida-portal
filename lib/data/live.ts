import "server-only";

import {
  brandLibraryForUser,
  decisionsForUser,
  deliverablesForUser,
  documentsForUser,
  milestonesForUser,
  openActionsForUser,
  projectForUser,
  projectsForUser,
  updatesForUser,
  type DeliverableRow,
  type LinkRow,
} from "../db/client-queries.ts";
import { bool } from "../db/d1.ts";
import type {
  ClientActionView,
  DeliverableView,
  Link,
  ProjectView,
  WorkspaceView,
} from "../types.ts";
import type { SessionUser } from "../auth/session.ts";

/**
 * Builds the client-lens view models from D1 rows.
 *
 * Every read here goes through client-queries.ts, which is scoped by the
 * caller's user id and refuses to touch internal tables. Nothing in this file
 * takes an id from a URL and trusts it — `slug` is always paired with the
 * session user, so asking for someone else's project returns nothing rather
 * than someone else's data.
 *
 * Round trips matter: we reach D1 over HTTP from Vercel, so independent queries
 * are issued with Promise.all rather than awaited in sequence. A project page
 * costs one round trip's latency, not six.
 */

function toLink(row: LinkRow): Link {
  return {
    id: row.id,
    url: row.url,
    label: row.label,
    provider: (row.provider as Link["provider"]) ?? "other",
    clientAccessOk: bool(row.client_access_ok),
    bestOnDesktop: bool(row.best_on_desktop),
  };
}

function toDeliverable(row: DeliverableRow, roundsIncluded: number): DeliverableView {
  return {
    id: row.id,
    name: row.name,
    typeName: row.type_name,
    status: row.status as DeliverableView["status"],
    round: row.current_round,
    roundsIncluded,
    dueOn: row.due_on,
    requiresConsideredReview: bool(row.requires_considered_review),
    reviewLink: row.review_url
      ? {
          id: `${row.id}_link`,
          url: row.review_url,
          label: row.review_label ?? "Open it",
          provider: "figma",
          clientAccessOk: bool(row.client_access_ok),
          bestOnDesktop: bool(row.best_on_desktop),
        }
      : null,
    updatedAt: row.state_changed_at,
    summary: row.summary,
  };
}

function toAction(row: Awaited<ReturnType<typeof openActionsForUser>>[number]): ClientActionView {
  return {
    id: row.id,
    projectId: row.project_id,
    projectSlug: row.project_slug,
    projectName: row.project_name,
    title: row.title,
    description: row.description,
    blocks: row.blocks_note,
    dueOn: row.due_on,
    status: row.status as ClientActionView["status"],
    createdAt: row.created_at,
  };
}

/* -------------------------------------------------------------------------- */

export async function liveWorkspace(user: SessionUser): Promise<WorkspaceView> {
  const [projects, actions, library] = await Promise.all([
    projectsForUser(user.id),
    openActionsForUser(user.id),
    brandLibraryForUser(user.id),
  ]);

  // Milestones are needed only for the "current stage" line on each card, so
  // fetch them per project in parallel rather than one after another.
  const milestoneSets = await Promise.all(
    projects.map((p) => milestonesForUser(user.id, p.id)),
  );

  return {
    accountId: "acc",
    accountName: projects[0]?.account_name ?? "",
    contactFirstName: user.firstName ?? user.fullName.split(" ")[0],
    waitingOnYou: actions.map(toAction),
    brandLibrary: library.map(toLink),
    projects: projects.map((p, i) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      typeName: p.type_name,
      health: p.health as ProjectView["health"],
      healthNote: p.health_note,
      targetEndOn: p.target_end_on,
      roundsIncluded: p.rounds_included,
      lastUpdatedAt: p.last_published_at ?? new Date().toISOString(),
      milestones: milestoneSets[i].map((m) => ({
        id: m.id,
        name: m.name,
        status: m.status as ProjectView["milestones"][number]["status"],
        targetDate: m.target_date,
        completedAt: m.completed_at,
      })),
      // The workspace cards don't render these; the project page fetches them.
      deliverables: [],
      updates: [],
      decisions: [],
      documents: [],
    })),
  };
}

export async function liveProject(
  user: SessionUser,
  slug: string,
): Promise<ProjectView | null> {
  const project = await projectForUser(user.id, slug);
  if (!project) return null;

  const [milestones, deliverables, updates, decisions, documents] = await Promise.all([
    milestonesForUser(user.id, project.id),
    deliverablesForUser(user.id, project.id),
    updatesForUser(user.id, project.id),
    decisionsForUser(user.id, project.id),
    documentsForUser(user.id, project.id),
  ]);

  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    typeName: project.type_name,
    health: project.health as ProjectView["health"],
    healthNote: project.health_note,
    targetEndOn: project.target_end_on,
    roundsIncluded: project.rounds_included,
    lastUpdatedAt: project.last_published_at ?? new Date().toISOString(),
    milestones: milestones.map((m) => ({
      id: m.id,
      name: m.name,
      status: m.status as ProjectView["milestones"][number]["status"],
      targetDate: m.target_date,
      completedAt: m.completed_at,
    })),
    deliverables: deliverables.map((d) => toDeliverable(d, project.rounds_included)),
    updates: updates.map((u) => ({
      id: u.id,
      body: u.body,
      publishedAt: u.published_at,
      author: u.author_name ?? "Griida",
      reviewDeliverableId: u.review_deliverable_id,
      documentLink: null,
    })),
    decisions: decisions.map((d) => ({
      id: d.id,
      summary: d.summary,
      decidedOn: d.decided_on,
      decidedBy: d.decided_by,
    })),
    documents: documents.map(toLink),
  };
}

export async function liveActions(
  user: SessionUser,
  projectId?: string,
): Promise<ClientActionView[]> {
  const rows = await openActionsForUser(user.id);
  const mapped = rows.map(toAction);
  return projectId ? mapped.filter((a) => a.projectId === projectId) : mapped;
}
