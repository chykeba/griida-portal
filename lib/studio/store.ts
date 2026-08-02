/**
 * Writes, against the in-memory demo data.
 *
 * These are real flows with real validation and real permission checks — the
 * only thing that isn't real is persistence: mutations live for the lifetime of
 * the server process and reset on restart. When Supabase is provisioned each
 * function here becomes an INSERT and nothing above it changes.
 *
 * Every mutation re-checks permissions rather than trusting that the UI hid
 * the button (see permissions.ts).
 */
import { demoStudio } from "./demo.ts";
import { assertCan } from "./permissions.ts";
import { findProjectType, instantiateChecklist } from "./templates.ts";
import type { Person, StudioProject, StudioRole } from "./types.ts";

export interface ClientAccount {
  id: string;
  name: string;
  slug: string;
  contactName: string;
  contactEmail: string;
  createdAt: string;
}

/** Client accounts, seeded from what the demo projects already reference. */
export const clientAccounts: ClientAccount[] = [
  {
    id: "acc_ovi",
    name: "Ovis Health",
    slug: "ovis-health",
    contactName: "Tunde",
    contactEmail: "tunde@ovishealth.com",
    createdAt: new Date(Date.now() - 60 * 86_400_000).toISOString(),
  },
];

/** People invited but not yet signed in — see the invitation gap in the README. */
export interface PendingInvite {
  email: string;
  name: string;
  role: StudioRole;
  invitedAt: string;
}
export const pendingInvites: PendingInvite[] = [];

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/* -------------------------------------------------------------------------- */

export interface CreateClientInput {
  name: string;
  contactName: string;
  contactEmail: string;
}

export function createClient(actor: Person, input: CreateClientInput): ClientAccount {
  assertCan(actor, "create_client");

  const name = input.name.trim();
  if (!name) throw new Error("Give the client a name.");

  const slug = slugify(name);
  if (clientAccounts.some((c) => c.slug === slug)) {
    throw new Error(`You already have a client called “${name}”.`);
  }

  const account: ClientAccount = {
    id: `acc_${slug}`,
    name,
    slug,
    contactName: input.contactName.trim(),
    contactEmail: input.contactEmail.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
  };
  clientAccounts.push(account);
  return account;
}

/* -------------------------------------------------------------------------- */

export interface CreateProjectInput {
  accountId: string;
  projectTypeId: string;
  name: string;
  leadId: string;
  targetEndOn: string | null;
  roundsIncluded: number;
  tags: string[];
}

/**
 * Create a project from its type — and instantiate everything with it (§10.2).
 *
 * This is what makes the SOP the default path rather than extra work. If a PM
 * had to attach checklists by hand afterwards, they wouldn't, and §5b would
 * quietly become decoration.
 */
export function createProject(actor: Person, input: CreateProjectInput): StudioProject {
  assertCan(actor, "create_project");

  const name = input.name.trim();
  if (!name) throw new Error("Give the project a name.");

  const account = clientAccounts.find((c) => c.id === input.accountId);
  if (!account) throw new Error("Pick a client for this project.");

  const type = findProjectType(input.projectTypeId);
  if (!type) throw new Error("Pick a project type — it decides the stages and checklists.");

  const slug = slugify(name);
  if (demoStudio.projects.some((p) => p.slug === slug)) {
    throw new Error(`There’s already a project called “${name}”. Names have to be unique.`);
  }

  const id = `prj_${slug}`;
  const now = new Date().toISOString();

  const project: StudioProject = {
    id,
    slug,
    name,
    clientName: account.name,
    typeName: type.name,
    health: "on_track",
    healthNote: "Just kicked off.",
    targetEndOn: input.targetEndOn,
    leadId: input.leadId,
    lastPublishedAt: null,
    tasks: [],
    clientActions: [],

    // Milestones from the template spine.
    deliverables: type.deliverables.map((dt, i) => ({
      id: `${id}_d${i + 1}`,
      name: dt.name,
      typeName: dt.name,
      status: "draft" as const,
      ownerId: null,
      round: 1,
      roundsIncluded: input.roundsIncluded,
      stateChangedAt: now,
      reviewUrl: null,
      linkAccessOk: null,
      // Snapshot, resolved against this project's tags. Never a live reference.
      checklist: dt.checklist
        ? instantiateChecklist(`${id}_d${i + 1}`, dt.checklist, input.tags)
        : null,
    })),
  };

  // Milestones live on the client-lens type; the studio view derives stages
  // from the template until the two data layers are merged behind Supabase.
  demoStudio.projects.push(project);
  return project;
}

/* -------------------------------------------------------------------------- */

export interface InviteTeamMemberInput {
  name: string;
  email: string;
  role: StudioRole;
}

/** Super admin only — the tightest permission in the product, deliberately. */
export function inviteTeamMember(actor: Person, input: InviteTeamMemberInput): PendingInvite {
  assertCan(actor, "manage_team");

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new Error("Who are you inviting?");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("That doesn’t look like an email address.");
  }
  if (demoStudio.people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`${name} is already on the team.`);
  }
  if (pendingInvites.some((i) => i.email === email)) {
    throw new Error("You’ve already invited that address. It’s still pending.");
  }

  const invite: PendingInvite = {
    email,
    name,
    role: input.role,
    invitedAt: new Date().toISOString(),
  };
  pendingInvites.push(invite);

  // Until auth lands the person exists immediately so the demo stays useful.
  // With Supabase this row appears only once they accept the magic link.
  demoStudio.people.push({
    id: `p_${slugify(name)}`,
    name,
    initials: name
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join(""),
    role: input.role,
  });

  return invite;
}
