import "server-only";

import {
  studioBlockers,
  studioChecklistItems,
  studioClientActions,
  studioDeliverables,
  studioPeople,
  studioProjects,
  studioTasks,
  type ChecklistItemRow,
} from "../db/studio-queries.ts";
import { bool } from "../db/d1.ts";
import type {
  Checklist,
  ChecklistItem,
  Person,
  Studio,
  StudioDeliverable,
  StudioProject,
  Task,
} from "./types.ts";

/**
 * Assembles the studio view model from D1.
 *
 * Seven tables in one pass. Every query is issued together with Promise.all and
 * then stitched in memory, rather than fetching per project — over an HTTP
 * database, the difference between one round trip and fifteen is the difference
 * between a page that feels instant and one that doesn't.
 *
 * The data set here is a studio's live projects: tens of rows, not thousands.
 * If that ever stops being true, the fix is scoping these queries by project,
 * not adding a cache in front of internal data.
 */
export async function liveStudio(currentPersonId: string): Promise<Studio> {
  const [people, projects, tasks, blockers, deliverables, checklistItems, actions] =
    await Promise.all([
      studioPeople(),
      studioProjects(),
      studioTasks(),
      studioBlockers(),
      studioDeliverables(),
      studioChecklistItems(),
      studioClientActions(),
    ]);

  const blockersByTask = groupBy(blockers, (b) => b.task_id);
  const itemsByDeliverable = groupBy(checklistItems, (i) => i.deliverable_id);
  const tasksByProject = groupBy(tasks, (t) => t.project_id);
  const deliverablesByProject = groupBy(deliverables, (d) => d.project_id);
  const actionsByProject = groupBy(actions, (a) => a.project_id);

  const studioProjectsOut: StudioProject[] = projects.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    clientName: p.client_name,
    typeName: p.type_name,
    health: p.health as StudioProject["health"],
    healthNote: p.health_note,
    targetEndOn: p.target_end_on,
    leadId: p.lead_id ?? "",
    lastPublishedAt: p.last_published_at,

    tasks: (tasksByProject.get(p.id) ?? []).map<Task>((t) => ({
      id: t.id,
      projectId: t.project_id,
      title: t.title,
      responsibleId: t.responsible_id,
      status: t.status as Task["status"],
      dueOn: t.due_on,
      deliverableId: t.deliverable_id,
      stateChangedAt: t.state_changed_at,
      blockers: (blockersByTask.get(t.id) ?? []).map((b) => ({
        id: b.id,
        // The schema calls it client_action; the view model calls it client.
        kind: b.kind === "client_action" ? "client" : (b.kind as "person" | "task"),
        blockedByPersonId: b.blocked_by_user ?? undefined,
        blockedByTaskId: b.blocked_by_task ?? undefined,
        clientActionId: b.client_action_id ?? undefined,
        note: b.note ?? "",
        createdAt: b.created_at,
        resolvedAt: b.resolved_at,
      })),
    })),

    deliverables: (deliverablesByProject.get(p.id) ?? []).map<StudioDeliverable>((d) => ({
      id: d.id,
      name: d.name,
      typeName: d.type_name,
      status: d.status as StudioDeliverable["status"],
      ownerId: d.owner_id,
      round: d.current_round,
      roundsIncluded: p.rounds_included,
      stateChangedAt: d.state_changed_at,
      reviewUrl: d.review_url,
      // NULL means never checked, which is different from "checked and failed".
      linkAccessOk: d.client_access_ok === null ? null : bool(d.client_access_ok),
      checklist: toChecklist(d.id, itemsByDeliverable.get(d.id) ?? []),
    })),

    clientActions: (actionsByProject.get(p.id) ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      dueOn: a.due_on,
      createdAt: a.created_at,
    })),
  }));

  return {
    currentPersonId,
    people: people.map<Person>((p) => ({
      id: p.id,
      name: p.first_name ?? p.full_name,
      initials: initialsOf(p.full_name),
      role: p.studio_role as Person["role"],
    })),
    projects: studioProjectsOut,
  };
}

function toChecklist(deliverableId: string, rows: ChecklistItemRow[]): Checklist | null {
  if (rows.length === 0) return null;
  return {
    deliverableId,
    templateName: rows[0].template_name,
    templateVersion: rows[0].source_version,
    items: rows.map<ChecklistItem>((r) => ({
      id: r.id,
      position: r.position,
      label: r.label,
      guidance: r.guidance,
      isRequired: bool(r.is_required),
      evidenceKind: r.evidence_kind as ChecklistItem["evidenceKind"],
      expectedSource: r.expected_source,
      requiresCountersign: bool(r.requires_countersign),
      isFinalDeliverable: bool(r.is_final_deliverable),
      state: r.state as ChecklistItem["state"],
      checkedById: r.checked_by,
      checkedAt: r.checked_at,
      countersignedById: r.countersigned_by,
      evidenceUrl: r.evidence_url,
      evidenceText: r.evidence_text,
      waivedReason: null,
    })),
  };
}

function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = out.get(k);
    if (bucket) bucket.push(row);
    else out.set(k, [row]);
  }
  return out;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}
