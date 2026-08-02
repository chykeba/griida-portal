import "server-only";

import { demoStudio } from "./demo.ts";
import { liveStudio } from "./live.ts";
import { getUser, isDemoMode } from "../auth/dal.ts";
import type { Person, Studio, StudioProject } from "./types.ts";

/**
 * Read layer for the studio lens — the mirror of lib/data/index.ts.
 *
 * Reads D1 when credentials are configured, fixtures when they are not, so the
 * public preview stays usable. Callers must already have passed
 * `requireStudio()`; this layer assumes the gate, it does not enforce it.
 */

export async function getStudio(): Promise<Studio> {
  if (isDemoMode()) return demoStudio;
  const user = await getUser();
  // Signed out under a live database: an empty studio rather than fixtures, so
  // nobody is ever shown another studio's work.
  if (!user) return { ...demoStudio, people: [], projects: [] };
  return liveStudio(user.id);
}

export async function getStudioProject(slug: string): Promise<StudioProject | null> {
  const studio = await getStudio();
  return studio.projects.find((p) => p.slug === slug) ?? null;
}

export async function getCurrentPerson(): Promise<Person> {
  if (isDemoMode()) {
    return demoStudio.people.find((p) => p.id === demoStudio.currentPersonId)!;
  }
  const user = await getUser();
  if (!user) {
    // Only reachable if a page renders without its gate. Return the least
    // privileged shape rather than throwing, so a mistake degrades to "can do
    // nothing" instead of a crash — or worse, an assumed admin.
    return { id: "", name: "", initials: "", role: "member" };
  }
  return {
    id: user.id,
    name: user.firstName ?? user.fullName,
    initials: user.fullName
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join(""),
    role: user.studioRole ?? "member",
  };
}
