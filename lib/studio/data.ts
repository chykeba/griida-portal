import { demoStudio } from "./demo.ts";
import type { Person, Studio, StudioProject } from "./types.ts";

export async function getStudio(): Promise<Studio> {
  return demoStudio;
}

export async function getStudioProject(slug: string): Promise<StudioProject | null> {
  const s = await getStudio();
  return s.projects.find((p) => p.slug === slug) ?? null;
}

export async function getCurrentPerson(): Promise<Person> {
  const s = await getStudio();
  return s.people.find((p) => p.id === s.currentPersonId)!;
}
