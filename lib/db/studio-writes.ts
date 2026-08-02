import "server-only";

import { query } from "./d1.ts";
import { randomToken } from "../auth/tokens.ts";

/**
 * Studio writes — the setup flows, against D1.
 *
 * These replace the in-memory store that `lib/studio/store.ts` used before the
 * read path moved to the database. That mismatch was a real bug: creating a
 * project appeared to work, then the redirect 404'd because the project only
 * existed in a module-level array.
 *
 * Permission checks live in the caller (`assertCan`), not here. These are the
 * data layer.
 */

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const STUDIO_ID = "studio_griida";

/* -------------------------------------------------------------------------- */
/* Clients                                                                     */
/* -------------------------------------------------------------------------- */

export async function createClientAccount(input: {
  name: string;
  contactName: string;
  contactEmail: string;
}): Promise<{ id: string; slug: string }> {
  const name = input.name.trim();
  if (!name) throw new Error("Give the client a name.");

  const slug = slugify(name);
  const existing = await query<{ id: string }>(
    `SELECT id FROM client_accounts WHERE studio_id = ?1 AND slug = ?2 LIMIT 1`,
    [STUDIO_ID, slug],
  );
  if (existing[0]) throw new Error(`You already have a client called “${name}”.`);

  const id = `acc_${slug}`;
  await query(
    `INSERT INTO client_accounts (id, studio_id, name, slug, contact_name, contact_email)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    [id, STUDIO_ID, name, slug, input.contactName.trim() || null,
     input.contactEmail.trim().toLowerCase() || null],
  );
  return { id, slug };
}

export async function listClientAccounts() {
  return query<{ id: string; name: string; slug: string; contact_name: string | null; contact_email: string | null; created_at: string }>(
    `SELECT id, name, slug, contact_name, contact_email, created_at
       FROM client_accounts WHERE studio_id = ?1 ORDER BY name`,
    [STUDIO_ID],
  );
}

/* -------------------------------------------------------------------------- */
/* Project types — read from the database, not from a TypeScript constant      */
/* -------------------------------------------------------------------------- */

export interface ProjectTypeSummary {
  id: string;
  name: string;
  tags: string[];
  milestones: string[];
  deliverables: { id: string; name: string; checklistItems: number; version: number | null }[];
}

export async function listProjectTypes(): Promise<ProjectTypeSummary[]> {
  const [types, milestones, deliverables] = await Promise.all([
    query<{ id: string; name: string; tags: string }>(
      `SELECT id, name, tags FROM project_types WHERE studio_id = ?1 AND is_active = 1 ORDER BY name`,
      [STUDIO_ID],
    ),
    query<{ project_type_id: string; name: string }>(
      `SELECT project_type_id, name FROM milestone_templates ORDER BY project_type_id, position`,
    ),
    query<{ id: string; project_type_id: string; name: string; version: number | null; items: number }>(
      `SELECT dt.id, dt.project_type_id, dt.name, ct.version,
              (SELECT count(*) FROM checklist_template_items i WHERE i.template_id = ct.id) AS items
         FROM deliverable_types dt
         LEFT JOIN checklist_templates ct
                ON ct.deliverable_type_id = dt.id AND ct.status = 'published'
        ORDER BY dt.project_type_id, dt.name`,
    ),
  ]);

  return types.map((t) => ({
    id: t.id,
    name: t.name,
    tags: safeTags(t.tags),
    milestones: milestones.filter((m) => m.project_type_id === t.id).map((m) => m.name),
    deliverables: deliverables
      .filter((d) => d.project_type_id === t.id)
      .map((d) => ({ id: d.id, name: d.name, checklistItems: d.items, version: d.version })),
  }));
}

function safeTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Projects                                                                    */
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
 * Create a project from its type, instantiating everything with it (§10.2).
 *
 * Milestones, deliverables and their checklists all arrive in one action.
 * Checklist items are **snapshotted** from the template — copied, never
 * referenced — so editing an SOP later cannot alter a project already running.
 * Conditional items are resolved here, once, against the project's tags.
 */
export async function createProjectInD1(
  input: CreateProjectInput,
): Promise<{ id: string; slug: string }> {
  const name = input.name.trim();
  if (!name) throw new Error("Give the project a name.");

  const account = await query<{ id: string }>(
    `SELECT id FROM client_accounts WHERE id = ?1 AND studio_id = ?2 LIMIT 1`,
    [input.accountId, STUDIO_ID],
  );
  if (!account[0]) throw new Error("Pick a client for this project.");

  const type = await query<{ id: string }>(
    `SELECT id FROM project_types WHERE id = ?1 AND studio_id = ?2 LIMIT 1`,
    [input.projectTypeId, STUDIO_ID],
  );
  if (!type[0]) {
    throw new Error("Pick a project type — it decides the stages and checklists.");
  }

  const slug = slugify(name);
  const clash = await query<{ id: string }>(
    `SELECT id FROM projects WHERE account_id = ?1 AND slug = ?2 LIMIT 1`,
    [input.accountId, slug],
  );
  if (clash[0]) {
    throw new Error(`That client already has a project called “${name}”.`);
  }

  const projectId = `prj_${slug}_${randomToken(4)}`;

  await query(
    `INSERT INTO projects (id, account_id, project_type_id, name, slug, status, health,
                           health_note, lead_id, applies_tags, rounds_included, target_end_on)
     VALUES (?1, ?2, ?3, ?4, ?5, 'active', 'on_track', 'Just kicked off.', ?6, ?7, ?8, ?9)`,
    [projectId, input.accountId, input.projectTypeId, name, slug, input.leadId || null,
     JSON.stringify(input.tags), input.roundsIncluded, input.targetEndOn],
  );

  // ---- milestones from the template spine --------------------------------
  const milestones = await query<{ id: string; name: string; position: number }>(
    `SELECT id, name, position FROM milestone_templates WHERE project_type_id = ?1 ORDER BY position`,
    [input.projectTypeId],
  );
  for (const m of milestones) {
    await query(
      `INSERT INTO milestones (id, project_id, name, position, status, source_template_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      [`${projectId}_m${m.position}`, projectId, m.name, m.position,
       m.position === 1 ? "in_progress" : "not_started", m.id],
    );
  }

  // ---- deliverables and their checklists ---------------------------------
  const deliverableTypes = await query<{
    id: string; name: string; requires_considered_review: number; template_id: string | null;
    template_version: number | null;
  }>(
    `SELECT dt.id, dt.name, dt.requires_considered_review,
            ct.id AS template_id, ct.version AS template_version
       FROM deliverable_types dt
       LEFT JOIN checklist_templates ct
              ON ct.deliverable_type_id = dt.id AND ct.status = 'published'
      WHERE dt.project_type_id = ?1
      ORDER BY dt.name`,
    [input.projectTypeId],
  );

  for (const [index, dt] of deliverableTypes.entries()) {
    const deliverableId = `${projectId}_d${index + 1}`;
    await query(
      `INSERT INTO deliverables (id, project_id, deliverable_type_id, name, type_name,
                                 status, current_round, requires_considered_review)
       VALUES (?1, ?2, ?3, ?4, ?4, 'draft', 1, ?5)`,
      [deliverableId, projectId, dt.id, dt.name, dt.requires_considered_review],
    );

    if (!dt.template_id) continue;

    const items = await query<{
      id: string; position: number; label: string; guidance: string | null;
      is_required: number; evidence_kind: string; expected_source: string | null;
      requires_countersign: number; is_final_deliverable: number; applies_when_tag: string | null;
    }>(
      `SELECT id, position, label, guidance, is_required, evidence_kind, expected_source,
              requires_countersign, is_final_deliverable, applies_when_tag
         FROM checklist_template_items WHERE template_id = ?1 ORDER BY position`,
      [dt.template_id],
    );

    // Conditional items resolved once, here, against this project's tags.
    const applicable = items.filter(
      (i) => !i.applies_when_tag || input.tags.includes(i.applies_when_tag),
    );
    if (applicable.length === 0) continue;

    const checklistId = `${deliverableId}_cl`;
    await query(
      `INSERT INTO checklists (id, scope, project_id, deliverable_id, template_name,
                               source_template_id, source_version)
       VALUES (?1, 'deliverable', ?2, ?3, ?4, ?5, ?6)`,
      [checklistId, projectId, deliverableId, dt.name, dt.template_id, dt.template_version ?? 1],
    );

    for (const [n, item] of applicable.entries()) {
      await query(
        `INSERT INTO checklist_items (id, checklist_id, position, label, guidance, is_required,
                                      evidence_kind, expected_source, requires_countersign,
                                      is_final_deliverable, is_applicable, state)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, 'open')`,
        [`${checklistId}_i${n + 1}`, checklistId, n + 1, item.label, item.guidance,
         item.is_required, item.evidence_kind, item.expected_source,
         item.requires_countersign, item.is_final_deliverable],
      );
    }
  }

  await query(
    `INSERT INTO activity_events (project_id, kind, subject_kind, subject_id, visibility)
     VALUES (?1, 'project.created', 'project', ?1, 'internal')`,
    [projectId],
  );

  return { id: projectId, slug };
}

/* -------------------------------------------------------------------------- */
/* Team                                                                        */
/* -------------------------------------------------------------------------- */

export async function inviteTeamMemberInD1(input: {
  name: string;
  email: string;
  role: string;
}): Promise<void> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new Error("Who are you inviting?");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("That doesn’t look like an email address.");
  }

  const existing = await query<{ id: string }>(
    `SELECT id FROM users WHERE email = ?1 LIMIT 1`,
    [email],
  );
  if (existing[0]) throw new Error("Someone already has that email address.");

  await query(
    `INSERT INTO users (id, email, kind, studio_id, studio_role, full_name, first_name)
     VALUES (?1, ?2, 'studio', ?3, ?4, ?5, ?6)`,
    [`u_${slugify(name)}_${randomToken(4)}`, email, STUDIO_ID, input.role, name,
     name.split(/\s+/)[0]],
  );
}
