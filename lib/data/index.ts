/**
 * Read layer for the client lens.
 *
 * Deliberately a narrow interface. When Supabase is provisioned, only this file
 * changes — every screen keeps consuming the same shapes. The queries it will
 * issue carry no visibility filters of their own, because visibility is
 * enforced by RLS (Architecture-and-Schema.md §2.2); if a client can see a row,
 * the database returned it.
 */
import { demoWorkspace } from "./demo.ts";
import type { ClientActionView, ProjectView, WorkspaceView } from "../types.ts";

export async function getWorkspace(): Promise<WorkspaceView> {
  return demoWorkspace;
}

export async function getProject(slug: string): Promise<ProjectView | null> {
  const ws = await getWorkspace();
  return ws.projects.find((p) => p.slug === slug) ?? null;
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
  const ws = await getWorkspace();
  const open = ws.waitingOnYou.filter((a) => a.status === "open");
  const scoped = projectId ? open.filter((a) => a.projectId === projectId) : open;
  // Oldest first: the thing that's been waiting longest is the thing that hurts.
  return scoped.sort((a, b) => {
    if (a.dueOn && b.dueOn) return a.dueOn.localeCompare(b.dueOn);
    if (a.dueOn) return -1;
    if (b.dueOn) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}
