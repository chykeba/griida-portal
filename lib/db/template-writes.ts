import "server-only";

import { query } from "./d1.ts";
import { NotPermitted } from "./checklist-writes.ts";
import { randomToken } from "../auth/tokens.ts";

/**
 * Authoring SOP templates (§5b).
 *
 * The versioning rule is the whole point, and it is easy to get wrong:
 *
 *   **A published template is immutable.** Editing one does not change it —
 *   it opens a *draft* at the next version number, with the items copied.
 *   Publishing that draft archives the previous version.
 *
 * Two things depend on this. Instances snapshot their items at creation, so a
 * live project is never altered by an edit — but every instance also records
 * `source_version`, and that number is only meaningful if the version it names
 * still says what it said. Mutating a published template in place would
 * silently rewrite the standard that every past project claims to have met.
 *
 * Drafts, by contrast, are freely editable. Nothing has shipped against them.
 */

const STUDIO_ID = "studio_griida";

export interface TemplateItem {
  id: string;
  position: number;
  label: string;
  guidance: string | null;
  isRequired: boolean;
  evidenceKind: "none" | "link" | "text";
  expectedSource: string | null;
  requiresCountersign: boolean;
  isFinalDeliverable: boolean;
  appliesWhenTag: string | null;
}

export interface TemplateVersion {
  id: string;
  deliverableTypeId: string;
  deliverableTypeName: string;
  projectTypeName: string;
  version: number;
  status: "draft" | "published" | "archived";
  items: TemplateItem[];
  /** How many live checklists were created from this exact version. */
  instancesUsing: number;
}

/* -------------------------------------------------------------------------- */

export async function listDeliverableTypes() {
  return query<{
    id: string; name: string; project_type_name: string;
    template_id: string | null; version: number | null; status: string | null; items: number;
  }>(
    `SELECT dt.id, dt.name, pt.name AS project_type_name,
            ct.id AS template_id, ct.version, ct.status,
            (SELECT count(*) FROM checklist_template_items i WHERE i.template_id = ct.id) AS items
       FROM deliverable_types dt
       JOIN project_types pt ON pt.id = dt.project_type_id
       LEFT JOIN checklist_templates ct
              ON ct.deliverable_type_id = dt.id
             AND ct.status IN ('draft','published')
      WHERE pt.studio_id = ?1
      ORDER BY pt.name, dt.name, ct.status DESC`,
    [STUDIO_ID],
  );
}

export async function loadTemplate(templateId: string): Promise<TemplateVersion | null> {
  const rows = await query<{
    id: string; deliverable_type_id: string; deliverable_type_name: string;
    project_type_name: string; version: number; status: TemplateVersion["status"];
  }>(
    `SELECT ct.id, ct.deliverable_type_id, dt.name AS deliverable_type_name,
            pt.name AS project_type_name, ct.version, ct.status
       FROM checklist_templates ct
       JOIN deliverable_types dt ON dt.id = ct.deliverable_type_id
       JOIN project_types pt ON pt.id = dt.project_type_id
      WHERE ct.id = ?1 LIMIT 1`,
    [templateId],
  );
  const t = rows[0];
  if (!t) return null;

  const [items, used] = await Promise.all([
    query<{
      id: string; position: number; label: string; guidance: string | null;
      is_required: number; evidence_kind: TemplateItem["evidenceKind"];
      expected_source: string | null; requires_countersign: number;
      is_final_deliverable: number; applies_when_tag: string | null;
    }>(
      `SELECT id, position, label, guidance, is_required, evidence_kind, expected_source,
              requires_countersign, is_final_deliverable, applies_when_tag
         FROM checklist_template_items WHERE template_id = ?1 ORDER BY position`,
      [templateId],
    ),
    query<{ n: number }>(
      `SELECT count(*) AS n FROM checklists WHERE source_template_id = ?1`,
      [templateId],
    ),
  ]);

  return {
    id: t.id,
    deliverableTypeId: t.deliverable_type_id,
    deliverableTypeName: t.deliverable_type_name,
    projectTypeName: t.project_type_name,
    version: t.version,
    status: t.status,
    instancesUsing: used[0]?.n ?? 0,
    items: items.map((i) => ({
      id: i.id,
      position: i.position,
      label: i.label,
      guidance: i.guidance,
      isRequired: i.is_required === 1,
      evidenceKind: i.evidence_kind,
      expectedSource: i.expected_source,
      requiresCountersign: i.requires_countersign === 1,
      isFinalDeliverable: i.is_final_deliverable === 1,
      appliesWhenTag: i.applies_when_tag,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Getting to an editable draft                                                */
/* -------------------------------------------------------------------------- */

/**
 * Returns a draft you may edit for this deliverable type, creating one if
 * needed.
 *
 * If a draft already exists, that. If the current version is published, a new
 * draft at version+1 with the items copied — the published one is never
 * touched. If there is no template at all, an empty draft at v1.
 */
export async function editableDraftFor(deliverableTypeId: string): Promise<string> {
  const existing = await query<{ id: string; version: number; status: string }>(
    `SELECT id, version, status FROM checklist_templates
      WHERE deliverable_type_id = ?1 ORDER BY version DESC`,
    [deliverableTypeId],
  );

  const draft = existing.find((t) => t.status === "draft");
  if (draft) return draft.id;

  const latest = existing[0];
  const nextVersion = (latest?.version ?? 0) + 1;
  const newId = `ct_${deliverableTypeId}_v${nextVersion}_${randomToken(4)}`;

  await query(
    `INSERT INTO checklist_templates (id, scope, deliverable_type_id, version, status)
     VALUES (?1, 'deliverable', ?2, ?3, 'draft')`,
    [newId, deliverableTypeId, nextVersion],
  );

  // Copy the published version's items so an edit starts from what exists,
  // rather than making the author retype a standard that already works.
  if (latest) {
    const items = await query<Record<string, unknown>>(
      `SELECT position, label, guidance, is_required, evidence_kind, expected_source,
              requires_countersign, is_final_deliverable, applies_when_tag
         FROM checklist_template_items WHERE template_id = ?1 ORDER BY position`,
      [latest.id],
    );
    for (const i of items) {
      await query(
        `INSERT INTO checklist_template_items
           (id, template_id, position, label, guidance, is_required, evidence_kind,
            expected_source, requires_countersign, is_final_deliverable, applies_when_tag)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
        [`cti_${randomToken(8)}`, newId, i.position, i.label, i.guidance, i.is_required,
         i.evidence_kind, i.expected_source, i.requires_countersign,
         i.is_final_deliverable, i.applies_when_tag],
      );
    }
  }

  return newId;
}

async function assertDraft(templateId: string): Promise<void> {
  const rows = await query<{ status: string; version: number }>(
    `SELECT status, version FROM checklist_templates WHERE id = ?1 LIMIT 1`,
    [templateId],
  );
  const t = rows[0];
  if (!t) throw new NotPermitted("That template has gone.");
  if (t.status !== "draft") {
    throw new NotPermitted(
      `Version ${t.version} is published, so it can’t be edited — projects already record having met it. ` +
        `Start a new draft instead.`,
    );
  }
}

export async function addItem(templateId: string, label: string): Promise<void> {
  await assertDraft(templateId);
  if (!label.trim()) throw new NotPermitted("Give the check a name.");

  const max = await query<{ n: number | null }>(
    `SELECT max(position) AS n FROM checklist_template_items WHERE template_id = ?1`,
    [templateId],
  );
  await query(
    `INSERT INTO checklist_template_items (id, template_id, position, label)
     VALUES (?1, ?2, ?3, ?4)`,
    [`cti_${randomToken(8)}`, templateId, (max[0]?.n ?? 0) + 1, label.trim()],
  );
}

export interface UpdateItemInput {
  label: string;
  guidance: string | null;
  evidenceKind: "none" | "link" | "text";
  expectedSource: string | null;
  requiresCountersign: boolean;
  isFinalDeliverable: boolean;
  appliesWhenTag: string | null;
  isRequired: boolean;
}

export async function updateItem(
  templateId: string,
  itemId: string,
  input: UpdateItemInput,
): Promise<void> {
  await assertDraft(templateId);
  if (!input.label.trim()) throw new NotPermitted("Give the check a name.");

  await query(
    `UPDATE checklist_template_items
        SET label = ?1, guidance = ?2, evidence_kind = ?3, expected_source = ?4,
            requires_countersign = ?5, is_final_deliverable = ?6,
            applies_when_tag = ?7, is_required = ?8
      WHERE id = ?9 AND template_id = ?10`,
    [input.label.trim(), input.guidance?.trim() || null, input.evidenceKind,
     input.expectedSource?.trim() || null, input.requiresCountersign ? 1 : 0,
     input.isFinalDeliverable ? 1 : 0, input.appliesWhenTag?.trim() || null,
     input.isRequired ? 1 : 0, itemId, templateId],
  );
}

export async function removeItem(templateId: string, itemId: string): Promise<void> {
  await assertDraft(templateId);
  await query(`DELETE FROM checklist_template_items WHERE id = ?1 AND template_id = ?2`, [
    itemId,
    templateId,
  ]);
  // Close the gap so positions stay dense — the UNIQUE(template_id, position)
  // constraint makes a hole a future insert failure.
  const rest = await query<{ id: string }>(
    `SELECT id FROM checklist_template_items WHERE template_id = ?1 ORDER BY position`,
    [templateId],
  );
  for (const [index, row] of rest.entries()) {
    await query(`UPDATE checklist_template_items SET position = ?1 WHERE id = ?2`, [
      // Offset well clear of existing values, then settle — otherwise the
      // unique constraint trips mid-renumber.
      1000 + index,
      row.id,
    ]);
  }
  for (const [index, row] of rest.entries()) {
    await query(`UPDATE checklist_template_items SET position = ?1 WHERE id = ?2`, [
      index + 1,
      row.id,
    ]);
  }
}

/** Publish a draft. The previously published version is archived, not deleted. */
export async function publishTemplate(templateId: string, actorId: string): Promise<void> {
  await assertDraft(templateId);

  const rows = await query<{ deliverable_type_id: string; version: number }>(
    `SELECT deliverable_type_id, version FROM checklist_templates WHERE id = ?1 LIMIT 1`,
    [templateId],
  );
  const t = rows[0];

  const count = await query<{ n: number }>(
    `SELECT count(*) AS n FROM checklist_template_items WHERE template_id = ?1`,
    [templateId],
  );
  if ((count[0]?.n ?? 0) === 0) {
    throw new NotPermitted("An empty checklist isn’t a standard. Add at least one check.");
  }

  await query(
    `UPDATE checklist_templates SET status = 'archived'
      WHERE deliverable_type_id = ?1 AND status = 'published'`,
    [t.deliverable_type_id],
  );
  await query(
    `UPDATE checklist_templates
        SET status = 'published', published_at = datetime('now'), published_by = ?1
      WHERE id = ?2`,
    [actorId, templateId],
  );
}

export async function discardDraft(templateId: string): Promise<void> {
  await assertDraft(templateId);
  await query(`DELETE FROM checklist_templates WHERE id = ?1`, [templateId]);
}
