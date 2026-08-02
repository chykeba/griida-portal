import "server-only";

import { demoWorkspace } from "./demo.ts";
import { liveActions, liveProject, liveWorkspace } from "./live.ts";
import { getUser, isDemoMode } from "../auth/dal.ts";
import type { ClientActionView, ProjectView, WorkspaceView } from "../types.ts";

/**
 * Read layer for the client lens — the one file that decides where data comes
 * from. Every screen consumes the same shapes either way.
 *
 * Two sources:
 *   - **D1**, scoped to the signed-in user, when credentials are configured;
 *   - **fixtures**, when they are not, so the public preview stays usable.
 *
 * The fallback is keyed off the absence of a database (see auth/dal.ts), which
 * is what makes it safe: if there is real data to protect there are
 * credentials, and if there are credentials this reads live and scoped.
 */

export async function getWorkspace(): Promise<WorkspaceView> {
  if (isDemoMode()) return demoWorkspace;
  const user = await getUser();
  // Signed out under a live database: return an empty shell rather than
  // fixtures, so nobody is ever shown data that isn't theirs.
  if (!user) return { ...demoWorkspace, projects: [], waitingOnYou: [], brandLibrary: [] };
  return liveWorkspace(user);
}

export async function getProject(slug: string): Promise<ProjectView | null> {
  if (isDemoMode()) {
    return demoWorkspace.projects.find((p) => p.slug === slug) ?? null;
  }
  const user = await getUser();
  if (!user) return null;
  return liveProject(user, slug);
}

export async function getDeliverable(slug: string, deliverableId: string) {
  const project = await getProject(slug);
  if (!project) return null;
  const deliverable = project.deliverables.find((d) => d.id === deliverableId);
  if (!deliverable) return null;
  return { project, deliverable };
}

/** The unified list — one to-do list, not three (§3). */
export async function getWaitingOnYou(projectId?: string): Promise<ClientActionView[]> {
  if (isDemoMode()) {
    const open = demoWorkspace.waitingOnYou.filter((a) => a.status === "open");
    return sortByUrgency(projectId ? open.filter((a) => a.projectId === projectId) : open);
  }
  const user = await getUser();
  if (!user) return [];
  return sortByUrgency(await liveActions(user, projectId));
}

/** Oldest first: the thing that’s been waiting longest is the thing that hurts. */
function sortByUrgency(items: ClientActionView[]): ClientActionView[] {
  return [...items].sort((a, b) => {
    if (a.dueOn && b.dueOn) return a.dueOn.localeCompare(b.dueOn);
    if (a.dueOn) return -1;
    if (b.dueOn) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}
