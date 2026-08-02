/**
 * Every SQL statement that runs on behalf of a client. All of it. In one file.
 *
 * This file is the client-facing attack surface, so it is deliberately small
 * and deliberately boring:
 *   - no query builder, no dynamic table names, no string concatenation of
 *     identifiers — `boundary.test.ts` scans this file textually, and it can
 *     only do that if the SQL is literal;
 *   - every statement is scoped by the caller's user id, never by an id taken
 *     from the URL alone. A client asking for a project they don't have a role
 *     on gets zero rows, not someone else's project.
 *
 * Postgres would have done the scoping for us. It doesn't any more, so every
 * `WHERE` clause below is load-bearing. Read them.
 */
import { queryAsClient } from "./d1.ts";

export interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  type_name: string;
  health: string;
  health_note: string | null;
  target_end_on: string | null;
  rounds_included: number;
  last_published_at: string | null;
  account_name: string;
}

/** Projects this user has a role on. Not "projects in their account". */
export async function projectsForUser(userId: string): Promise<ProjectRow[]> {
  return queryAsClient<ProjectRow>(
    `SELECT p.id, p.slug, p.name, p.health, p.health_note, p.target_end_on,
            p.rounds_included, p.last_published_at,
            a.name AS account_name, a.name AS type_name
       FROM projects p
       JOIN client_accounts a ON a.id = p.account_id
       JOIN project_client_roles r ON r.project_id = p.id
      WHERE r.user_id = ?1
        AND p.status IN ('active','on_hold','done')
      ORDER BY p.created_at DESC`,
    [userId],
    "projectsForUser",
  );
}

export async function projectForUser(
  userId: string,
  slug: string,
): Promise<ProjectRow | null> {
  const rows = await queryAsClient<ProjectRow>(
    `SELECT p.id, p.slug, p.name, p.health, p.health_note, p.target_end_on,
            p.rounds_included, p.last_published_at,
            a.name AS account_name, a.name AS type_name
       FROM projects p
       JOIN client_accounts a ON a.id = p.account_id
       JOIN project_client_roles r ON r.project_id = p.id
      WHERE r.user_id = ?1 AND p.slug = ?2
      LIMIT 1`,
    [userId, slug],
    "projectForUser",
  );
  return rows[0] ?? null;
}

export interface MilestoneRow {
  id: string;
  name: string;
  status: string;
  target_date: string | null;
  completed_at: string | null;
}

export async function milestonesForUser(userId: string, projectId: string) {
  return queryAsClient<MilestoneRow>(
    `SELECT m.id, m.name, m.status, m.target_date, m.completed_at
       FROM milestones m
       JOIN project_client_roles r ON r.project_id = m.project_id
      WHERE r.user_id = ?1 AND m.project_id = ?2
      ORDER BY m.position`,
    [userId, projectId],
    "milestonesForUser",
  );
}

export interface DeliverableRow {
  id: string;
  name: string;
  type_name: string;
  status: string;
  summary: string | null;
  current_round: number;
  requires_considered_review: number;
  state_changed_at: string;
  review_url: string | null;
  review_label: string | null;
  best_on_desktop: number | null;
  client_access_ok: number | null;
}

/**
 * Drafts are excluded here — that exclusion is the publish gate as far as the
 * client is concerned, and it used to be an RLS policy.
 */
export async function deliverablesForUser(userId: string, projectId: string) {
  return queryAsClient<DeliverableRow>(
    `SELECT d.id, d.name, d.type_name, d.status, d.summary, d.current_round,
            d.requires_considered_review, d.state_changed_at,
            l.url AS review_url, l.label AS review_label,
            l.best_on_desktop, l.client_access_ok
       FROM deliverables d
       JOIN project_client_roles r ON r.project_id = d.project_id
       LEFT JOIN deliverable_versions v
              ON v.deliverable_id = d.id AND v.round = d.current_round
       LEFT JOIN links l ON l.id = v.review_link_id
      WHERE r.user_id = ?1
        AND d.project_id = ?2
        AND d.status != 'draft'
      ORDER BY d.created_at DESC`,
    [userId, projectId],
    "deliverablesForUser",
  );
}

export interface UpdateRow {
  id: string;
  body: string;
  published_at: string;
  author_name: string | null;
  review_deliverable_id: string | null;
}

/** Only published updates. A draft is internal until someone decides otherwise. */
export async function updatesForUser(userId: string, projectId: string) {
  return queryAsClient<UpdateRow>(
    `SELECT u.id, u.body, u.published_at, u.review_deliverable_id,
            au.first_name AS author_name
       FROM updates u
       JOIN project_client_roles r ON r.project_id = u.project_id
       LEFT JOIN users au ON au.id = u.published_by
      WHERE r.user_id = ?1
        AND u.project_id = ?2
        AND u.status = 'published'
      ORDER BY u.published_at DESC`,
    [userId, projectId],
    "updatesForUser",
  );
}

export interface ClientActionRow {
  id: string;
  project_id: string;
  project_slug: string;
  project_name: string;
  title: string;
  description: string | null;
  blocks_note: string | null;
  due_on: string | null;
  status: string;
  created_at: string;
}

/** The unified "waiting on you" list, across every project (§3). */
export async function openActionsForUser(userId: string) {
  return queryAsClient<ClientActionRow>(
    `SELECT c.id, c.project_id, c.title, c.description, c.blocks_note,
            c.due_on, c.status, c.created_at,
            p.slug AS project_slug, p.name AS project_name
       FROM client_actions c
       JOIN projects p ON p.id = c.project_id
       JOIN project_client_roles r ON r.project_id = c.project_id
      WHERE r.user_id = ?1 AND c.status = 'open'
      ORDER BY c.due_on IS NULL, c.due_on, c.created_at`,
    [userId],
    "openActionsForUser",
  );
}

export interface DecisionRow {
  id: string;
  summary: string;
  decided_on: string;
  decided_by: string;
}

export async function decisionsForUser(userId: string, projectId: string) {
  return queryAsClient<DecisionRow>(
    `SELECT d.id, d.summary, d.decided_on, d.decided_by
       FROM decisions d
       JOIN project_client_roles r ON r.project_id = d.project_id
      WHERE r.user_id = ?1
        AND d.project_id = ?2
        AND d.is_client_visible = 1
      ORDER BY d.decided_on DESC`,
    [userId, projectId],
    "decisionsForUser",
  );
}

export interface LinkRow {
  id: string;
  url: string;
  label: string;
  provider: string;
  best_on_desktop: number;
  client_access_ok: number | null;
}

export async function documentsForUser(userId: string, projectId: string) {
  return queryAsClient<LinkRow>(
    `SELECT l.id, l.url, l.label, l.provider, l.best_on_desktop, l.client_access_ok
       FROM project_documents pd
       JOIN links l ON l.id = pd.link_id
       JOIN project_client_roles r ON r.project_id = pd.project_id
      WHERE r.user_id = ?1
        AND pd.project_id = ?2
        AND pd.is_client_visible = 1
      ORDER BY pd.created_at DESC`,
    [userId, projectId],
    "documentsForUser",
  );
}

/** The account-level brand library, which persists between projects (§3a). */
export async function brandLibraryForUser(userId: string) {
  return queryAsClient<LinkRow>(
    `SELECT l.id, l.url, l.label, l.provider, l.best_on_desktop, l.client_access_ok
       FROM brand_library_items b
       JOIN links l ON l.id = b.link_id
       JOIN account_members am ON am.account_id = b.account_id
      WHERE am.user_id = ?1
      ORDER BY b.created_at DESC`,
    [userId],
    "brandLibraryForUser",
  );
}

export interface PassedCheckRow {
  id: string;
  label: string;
  position: number;
}

/**
 * The delivery standard a piece of work passed — what we checked before
 * sending it.
 *
 * Only settled items, and only the label. Deliberately selects none of
 * FORBIDDEN_CLIENT_COLUMNS: the client sees the standard, not who signed it
 * off, on what evidence, or what was waived. A waived item simply isn\'t
 * listed — we make no claim about a check we didn\'t perform.
 */
export async function passedChecksForUser(userId: string, deliverableId: string) {
  return queryAsClient<PassedCheckRow>(
    `SELECT i.id, i.label, i.position
       FROM checklist_items i
       JOIN checklists c ON c.id = i.checklist_id
       JOIN deliverables d ON d.id = c.deliverable_id
       JOIN project_client_roles r ON r.project_id = d.project_id
      WHERE r.user_id = ?1
        AND c.deliverable_id = ?2
        AND d.status != 'draft'
        AND i.is_applicable = 1
        AND i.state IN ('checked','countersigned')
      ORDER BY i.position`,
    [userId, deliverableId],
    "passedChecksForUser",
  );
}
