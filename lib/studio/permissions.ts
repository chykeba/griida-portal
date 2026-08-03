/**
 * Who may do what.
 *
 * Single source of truth, used by BOTH the UI (to decide what to render) and
 * the server actions (to decide what to allow). Hiding a button is not
 * authorisation — every mutation re-checks here.
 *
 * There is no second line of defence. D1 has no row-level security, so unlike
 * a Postgres deployment there is no database-side policy to catch a missed
 * check. This module and the server actions that call it ARE the boundary.
 *
 * The model, as decided:
 *   PM and super admin  — create projects, create clients
 *   Super admin only    — add team members, author SOP templates
 */
import type { Person, StudioRole } from "./types.ts";

export type Capability =
  | "create_project"
  | "create_client"
  | "manage_team"
  | "author_templates"
  | "publish_update"
  | "waive_checklist_item"
  /** Grant or revoke a client's sight of a project. */
  | "manage_project_clients"
  /** Assert a client can open a review link — the one gate with no override. */
  | "attest_link_access";

const BY_ROLE: Record<StudioRole, Capability[]> = {
  super_admin: [
    "create_project",
    "create_client",
    "manage_team",
    "author_templates",
    "publish_update",
    "waive_checklist_item",
    "manage_project_clients",
    "attest_link_access",
  ],
  admin_pm: [
    "create_project",
    "create_client",
    "publish_update",
    "waive_checklist_item",
    "manage_project_clients",
    "attest_link_access",
  ],
  lead: ["publish_update", "attest_link_access"],
  member: [],
};

export function can(person: Person, capability: Capability): boolean {
  return BY_ROLE[person.role].includes(capability);
}

/** Thrown by server actions when the UI and the rules disagree. */
export class NotAllowed extends Error {
  constructor(capability: Capability) {
    super(`You don’t have permission to do that (${capability}).`);
    this.name = "NotAllowed";
  }
}

export function assertCan(person: Person, capability: Capability): void {
  if (!can(person, capability)) throw new NotAllowed(capability);
}

export const ROLE_LABEL: Record<StudioRole, string> = {
  super_admin: "Super admin",
  admin_pm: "Project manager",
  lead: "Lead",
  member: "Team member",
};

export const ROLE_BLURB: Record<StudioRole, string> = {
  super_admin: "Everything, including SOP checklists and who’s on the team.",
  admin_pm: "Runs projects and clients. Can publish to clients.",
  lead: "Works on projects and countersigns others’ checklist items.",
  member: "Works on projects and ticks their own checklist items.",
};
