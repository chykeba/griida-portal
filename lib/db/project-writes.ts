import "server-only";

import { query } from "./d1.ts";
import { NotPermitted } from "./checklist-writes.ts";
import { randomToken, looksLikeEmail, normaliseEmail } from "../auth/tokens.ts";

/**
 * The three writes that stand between a demo and a usable tool:
 * giving a client access, asking them for something, and saying how it's going.
 */

/* -------------------------------------------------------------------------- */
/* Who can see a project (§3 — roles are per project, not global)             */
/* -------------------------------------------------------------------------- */

export interface ProjectClient {
  userId: string;
  email: string;
  fullName: string;
  role: "owner" | "reviewer" | "viewer";
  hasSignedIn: boolean;
}

export async function projectClients(projectId: string): Promise<ProjectClient[]> {
  const rows = await query<{
    user_id: string; email: string; full_name: string;
    role: ProjectClient["role"]; sessions: number;
  }>(
    `SELECT r.user_id, u.email, u.full_name, r.role,
            (SELECT count(*) FROM sessions s WHERE s.user_id = u.id) AS sessions
       FROM project_client_roles r
       JOIN users u ON u.id = r.user_id
      WHERE r.project_id = ?1
      ORDER BY CASE r.role WHEN 'owner' THEN 1 WHEN 'reviewer' THEN 2 ELSE 3 END, u.full_name`,
    [projectId],
  );
  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    fullName: r.full_name,
    role: r.role,
    hasSignedIn: r.sessions > 0,
  }));
}

/**
 * Adds a client contact to a project, creating their user record if this is
 * the first time we've worked with them.
 *
 * Roles are per project on purpose (§3): someone can be an owner on the
 * rebrand and a viewer on the website. There is no global "client" role, and
 * adding someone to an account does not give them sight of its projects.
 */
export async function addClientToProject(input: {
  projectId: string;
  name: string;
  email: string;
  role: ProjectClient["role"];
}): Promise<{ userId: string; isNew: boolean }> {
  const name = input.name.trim();
  const email = normaliseEmail(input.email);
  if (!name) throw new Error("Who are you adding?");
  if (!looksLikeEmail(email)) throw new Error("That doesn’t look like an email address.");

  const project = await query<{ account_id: string }>(
    `SELECT account_id FROM projects WHERE id = ?1 LIMIT 1`,
    [input.projectId],
  );
  if (!project[0]) throw new Error("That project has gone.");

  const existing = await query<{ id: string; kind: string }>(
    `SELECT id, kind FROM users WHERE email = ?1 LIMIT 1`,
    [email],
  );

  let userId: string;
  let isNew = false;

  if (existing[0]) {
    if (existing[0].kind === "studio") {
      throw new Error(
        `${email} is on the studio team. Adding them as a client would give them a second, ` +
          `separate view of this project — probably not what you meant.`,
      );
    }
    userId = existing[0].id;
  } else {
    userId = `u_${randomToken(8)}`;
    isNew = true;
    // Client users carry no studio_id and no role; they reach a studio through
    // account_members instead.
    await query(
      `INSERT INTO users (id, email, kind, full_name, first_name)
       VALUES (?1, ?2, 'client', ?3, ?4)`,
      [userId, email, name, name.split(/\s+/)[0]],
    );
  }

  await query(
    `INSERT OR IGNORE INTO account_members (account_id, user_id) VALUES (?1, ?2)`,
    [project[0].account_id, userId],
  );
  await query(
    `INSERT OR REPLACE INTO project_client_roles (project_id, user_id, role) VALUES (?1, ?2, ?3)`,
    [input.projectId, userId, input.role],
  );

  return { userId, isNew };
}

export async function removeClientFromProject(
  projectId: string,
  userId: string,
): Promise<void> {
  // Only the project role goes. Their account membership and history stay —
  // removing someone from one job shouldn't erase them from the relationship.
  await query(`DELETE FROM project_client_roles WHERE project_id = ?1 AND user_id = ?2`, [
    projectId,
    userId,
  ]);
}

/* -------------------------------------------------------------------------- */
/* Asking the client for something (§5A)                                      */
/* -------------------------------------------------------------------------- */

export async function createClientAction(input: {
  projectId: string;
  title: string;
  description: string | null;
  blocksNote: string | null;
  dueOn: string | null;
  actorId: string;
}): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new NotPermitted("What are you asking them for?");

  const id = `ca_${randomToken(8)}`;
  await query(
    `INSERT INTO client_actions (id, project_id, title, description, blocks_note, due_on, status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'open')`,
    [id, input.projectId, title, input.description?.trim() || null,
     input.blocksNote?.trim() || null, input.dueOn || null],
  );
  await query(
    `INSERT INTO activity_events (project_id, actor_id, kind, subject_kind, subject_id, visibility)
     VALUES (?1, ?2, 'client_action.created', 'client_action', ?3, 'client')`,
    [input.projectId, input.actorId, id],
  );
  return id;
}

/** The studio accepts what came back, closing the loop. */
export async function acceptClientAction(actionId: string, actorId: string): Promise<void> {
  await query(
    `UPDATE client_actions SET status = 'accepted', accepted_at = datetime('now')
      WHERE id = ?1 AND status = 'submitted'`,
    [actionId],
  );
  const row = await query<{ project_id: string }>(
    `SELECT project_id FROM client_actions WHERE id = ?1 LIMIT 1`,
    [actionId],
  );
  if (row[0]) {
    await query(
      `INSERT INTO activity_events (project_id, actor_id, kind, subject_kind, subject_id, visibility)
       VALUES (?1, ?2, 'client_action.accepted', 'client_action', ?3, 'internal')`,
      [row[0].project_id, actorId, actionId],
    );
  }
}

export async function reopenClientAction(actionId: string, actorId: string): Promise<void> {
  await query(
    `UPDATE client_actions SET status = 'open', submitted_at = NULL, accepted_at = NULL
      WHERE id = ?1`,
    [actionId],
  );
  const row = await query<{ project_id: string }>(
    `SELECT project_id FROM client_actions WHERE id = ?1 LIMIT 1`,
    [actionId],
  );
  if (row[0]) {
    await query(
      `INSERT INTO activity_events (project_id, actor_id, kind, subject_kind, subject_id, visibility)
       VALUES (?1, ?2, 'client_action.reopened', 'client_action', ?3, 'client')`,
      [row[0].project_id, actorId, actionId],
    );
  }
}

/* -------------------------------------------------------------------------- */
/* How it's going (§3, §6)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Sets health and the plain-English why.
 *
 * The note is required when anything other than on-track, because §6's whole
 * argument is that "at risk" with no explanation is worse than silence — it
 * creates alarm without giving the client anything to do with it.
 */
export async function setHealth(input: {
  projectId: string;
  health: "on_track" | "at_risk" | "blocked";
  note: string;
  actorId: string;
}): Promise<void> {
  const note = input.note.trim();
  if (input.health !== "on_track" && !note) {
    throw new NotPermitted(
      "Say why in a sentence. A status without a reason worries people without telling them anything.",
    );
  }

  await query(
    `UPDATE projects SET health = ?1, health_note = ?2, health_set_by = ?3,
            health_set_at = datetime('now')
      WHERE id = ?4`,
    [input.health, note || null, input.actorId, input.projectId],
  );
  await query(
    `INSERT INTO activity_events (project_id, actor_id, kind, subject_kind, subject_id, visibility, payload)
     VALUES (?1, ?2, 'project.health_changed', 'project', ?1, 'client', ?3)`,
    [input.projectId, input.actorId, JSON.stringify({ health: input.health, note })],
  );
}
