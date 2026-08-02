import "server-only";

/**
 * Internal reads — the studio lens.
 *
 * These reach everything: tasks, blockers, checklist evidence, waivers, draft
 * updates. That is the point, and it is why nothing here may ever be imported
 * from a client path. `boundary.test.ts` asserts that separation.
 *
 * Callers must have passed `requireStudio()` first. These functions do not
 * check permissions themselves — they are the data layer, not the gate — so
 * treat every export here as "studio eyes only" by construction.
 */
import { query } from "./d1.ts";

export interface PersonRow {
  id: string;
  full_name: string;
  first_name: string | null;
  studio_role: string;
}

export async function studioPeople(): Promise<PersonRow[]> {
  return query<PersonRow>(
    `SELECT id, full_name, first_name, studio_role
       FROM users
      WHERE kind = 'studio' AND is_active = 1
      ORDER BY CASE studio_role
                 WHEN 'super_admin' THEN 1 WHEN 'admin_pm' THEN 2
                 WHEN 'lead' THEN 3 ELSE 4 END, full_name`,
  );
}

export interface StudioProjectRow {
  id: string;
  slug: string;
  name: string;
  client_name: string;
  type_name: string;
  health: string;
  health_note: string | null;
  target_end_on: string | null;
  lead_id: string | null;
  rounds_included: number;
  last_published_at: string | null;
}

export async function studioProjects(): Promise<StudioProjectRow[]> {
  return query<StudioProjectRow>(
    `SELECT p.id, p.slug, p.name, p.health, p.health_note, p.target_end_on,
            p.lead_id, p.rounds_included, p.last_published_at,
            a.name AS client_name, t.name AS type_name
       FROM projects p
       JOIN client_accounts a ON a.id = p.account_id
       JOIN project_types t ON t.id = p.project_type_id
      WHERE p.status IN ('active','on_hold','draft')
      ORDER BY p.created_at DESC`,
  );
}

export interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  responsible_id: string | null;
  status: string;
  due_on: string | null;
  deliverable_id: string | null;
  state_changed_at: string;
}

export async function studioTasks(): Promise<TaskRow[]> {
  return query<TaskRow>(
    `SELECT id, project_id, title, responsible_id, status, due_on,
            deliverable_id, state_changed_at
       FROM tasks
      ORDER BY due_on IS NULL, due_on`,
  );
}

export interface BlockerRow {
  id: string;
  task_id: string;
  kind: string;
  blocked_by_user: string | null;
  blocked_by_task: string | null;
  client_action_id: string | null;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export async function studioBlockers(): Promise<BlockerRow[]> {
  return query<BlockerRow>(
    `SELECT id, task_id, kind, blocked_by_user, blocked_by_task, client_action_id,
            note, created_at, resolved_at
       FROM task_blockers
      WHERE resolved_at IS NULL
      ORDER BY created_at`,
  );
}

export interface StudioDeliverableRow {
  id: string;
  project_id: string;
  name: string;
  type_name: string;
  status: string;
  owner_id: string | null;
  current_round: number;
  state_changed_at: string;
  summary: string | null;
  requires_considered_review: number;
  review_url: string | null;
  client_access_ok: number | null;
}

export async function studioDeliverables(): Promise<StudioDeliverableRow[]> {
  return query<StudioDeliverableRow>(
    `SELECT d.id, d.project_id, d.name, d.type_name, d.status, d.owner_id,
            d.current_round, d.state_changed_at, d.summary,
            d.requires_considered_review,
            l.url AS review_url, l.client_access_ok
       FROM deliverables d
       LEFT JOIN deliverable_versions v
              ON v.deliverable_id = d.id AND v.round = d.current_round
       LEFT JOIN links l ON l.id = v.review_link_id
      ORDER BY d.created_at DESC`,
  );
}

export interface ChecklistItemRow {
  id: string;
  deliverable_id: string;
  template_name: string;
  source_version: number;
  position: number;
  label: string;
  guidance: string | null;
  is_required: number;
  evidence_kind: string;
  expected_source: string | null;
  requires_countersign: number;
  is_final_deliverable: number;
  state: string;
  checked_by: string | null;
  checked_at: string | null;
  countersigned_by: string | null;
  evidence_text: string | null;
  evidence_url: string | null;
}

/** Every checklist item across every deliverable, grouped by caller. */
export async function studioChecklistItems(): Promise<ChecklistItemRow[]> {
  return query<ChecklistItemRow>(
    `SELECT i.id, c.deliverable_id, c.template_name, c.source_version,
            i.position, i.label, i.guidance, i.is_required, i.evidence_kind,
            i.expected_source, i.requires_countersign, i.is_final_deliverable,
            i.state, i.checked_by, i.checked_at, i.countersigned_by,
            i.evidence_text, l.url AS evidence_url
       FROM checklist_items i
       JOIN checklists c ON c.id = i.checklist_id
       LEFT JOIN links l ON l.id = i.evidence_link_id
      WHERE i.is_applicable = 1 AND c.deliverable_id IS NOT NULL
      ORDER BY c.deliverable_id, i.position`,
  );
}

export interface StudioActionRow {
  id: string;
  project_id: string;
  title: string;
  due_on: string | null;
  created_at: string;
}

export async function studioClientActions(): Promise<StudioActionRow[]> {
  return query<StudioActionRow>(
    `SELECT id, project_id, title, due_on, created_at
       FROM client_actions
      WHERE status = 'open'
      ORDER BY created_at`,
  );
}
