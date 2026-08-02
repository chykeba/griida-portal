import "server-only";

import { query } from "./d1.ts";
import type { StudioRole } from "../studio/types.ts";

/**
 * Checklist mutations (§5b).
 *
 * Two things make this an SOP rather than a to-do list, and both live here
 * rather than in the UI:
 *
 *  - **Every change is a signed event.** `checklist_item_events` is append-only
 *    (enforced by a trigger, not a convention). The `state` column on
 *    `checklist_items` is a projection written alongside it, purely so reads
 *    are cheap. Unticking does not erase anything — it appends.
 *
 *  - **You cannot countersign your own attestation.** Separation of duties that
 *    the same human can satisfy is theatre. `canCountersign` existed as a pure
 *    function the UI consulted; now the write path enforces it, so reaching the
 *    action directly still fails.
 */

export interface ItemContext {
  itemId: string;
  checklistId: string;
  deliverableId: string;
  projectId: string;
  label: string;
  state: "open" | "checked" | "countersigned" | "waived";
  requiresCountersign: boolean;
  evidenceKind: "none" | "link" | "text";
  checkedBy: string | null;
  ownerId: string | null;
}

export async function itemContext(itemId: string): Promise<ItemContext | null> {
  const rows = await query<{
    id: string; checklist_id: string; deliverable_id: string; project_id: string;
    label: string; state: ItemContext["state"]; requires_countersign: number;
    evidence_kind: ItemContext["evidenceKind"]; checked_by: string | null;
    owner_id: string | null;
  }>(
    `SELECT i.id, i.checklist_id, c.deliverable_id, c.project_id, i.label, i.state,
            i.requires_countersign, i.evidence_kind, i.checked_by, d.owner_id
       FROM checklist_items i
       JOIN checklists c ON c.id = i.checklist_id
       JOIN deliverables d ON d.id = c.deliverable_id
      WHERE i.id = ?1
      LIMIT 1`,
    [itemId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    itemId: r.id,
    checklistId: r.checklist_id,
    deliverableId: r.deliverable_id,
    projectId: r.project_id,
    label: r.label,
    state: r.state,
    requiresCountersign: r.requires_countersign === 1,
    evidenceKind: r.evidence_kind,
    checkedBy: r.checked_by,
    ownerId: r.owner_id,
  };
}

export class NotPermitted extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotPermitted";
  }
}

const SENIOR: StudioRole[] = ["lead", "admin_pm", "super_admin"];

/** The people who did the work attest to it; seniors may step in. */
export function mayTick(ctx: ItemContext, actorId: string, role: StudioRole): boolean {
  return ctx.ownerId === actorId || SENIOR.includes(role);
}

/**
 * A countersign must come from someone other than whoever ticked it. This is
 * the whole point of the flag — a second pair of eyes, not the same pair twice.
 */
export function mayCountersign(
  ctx: ItemContext,
  actorId: string,
  role: StudioRole,
): { ok: true } | { ok: false; why: string } {
  if (!ctx.requiresCountersign) {
    return { ok: false, why: "That item doesn’t need a second pair of eyes." };
  }
  if (ctx.state !== "checked") {
    return { ok: false, why: "There’s nothing to countersign until someone has checked it." };
  }
  if (ctx.checkedBy === actorId) {
    return {
      ok: false,
      why: "You checked this one, so someone else has to countersign it — that’s the point of the second signature.",
    };
  }
  if (!SENIOR.includes(role)) {
    return { ok: false, why: "Countersigning is for leads and above." };
  }
  return { ok: true };
}

/* -------------------------------------------------------------------------- */

async function appendEvent(
  itemId: string,
  kind: string,
  actorId: string,
  extra: { evidenceLinkId?: string | null; evidenceText?: string | null; reason?: string | null } = {},
): Promise<void> {
  await query(
    `INSERT INTO checklist_item_events (item_id, kind, actor_id, evidence_link_id, evidence_text, reason)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    [itemId, kind, actorId, extra.evidenceLinkId ?? null, extra.evidenceText ?? null, extra.reason ?? null],
  );
}

export async function tick(
  ctx: ItemContext,
  actorId: string,
  role: StudioRole,
  evidence: { url?: string | null; text?: string | null },
): Promise<void> {
  if (!mayTick(ctx, actorId, role)) {
    throw new NotPermitted(
      "Only whoever owns this deliverable can tick its items — or a lead, if they've actually checked.",
    );
  }
  if (ctx.evidenceKind === "link" && !evidence.url?.trim()) {
    throw new NotPermitted("This one needs a link to where the work is.");
  }
  if (ctx.evidenceKind === "text" && !evidence.text?.trim()) {
    throw new NotPermitted("This one needs a note saying what you found.");
  }

  let linkId: string | null = null;
  if (evidence.url?.trim()) {
    linkId = `lnk_ev_${ctx.itemId}`;
    await query(
      `INSERT OR REPLACE INTO links (id, url, label, provider, added_by, client_access_ok)
       VALUES (?1, ?2, ?3, 'other', ?4, NULL)`,
      [linkId, evidence.url.trim(), `Evidence: ${ctx.label}`, actorId],
    );
  }

  const now = new Date().toISOString();
  await appendEvent(ctx.itemId, "checked", actorId, {
    evidenceLinkId: linkId,
    evidenceText: evidence.text?.trim() || null,
  });
  await query(
    `UPDATE checklist_items
        SET state = 'checked', state_changed_at = ?1, checked_by = ?2, checked_at = ?1,
            evidence_link_id = ?3, evidence_text = ?4, countersigned_by = NULL
      WHERE id = ?5`,
    [now, actorId, linkId, evidence.text?.trim() || null, ctx.itemId],
  );
}

export async function untick(ctx: ItemContext, actorId: string, role: StudioRole, reason: string): Promise<void> {
  if (!mayTick(ctx, actorId, role)) {
    throw new NotPermitted("You can’t change items on someone else’s deliverable.");
  }
  if (!reason.trim()) {
    throw new NotPermitted("Say why you’re unticking it — the log keeps the reason, not just the change.");
  }
  // Appends. The original attestation stays in the log forever.
  await appendEvent(ctx.itemId, "unchecked", actorId, { reason: reason.trim() });
  await query(
    `UPDATE checklist_items
        SET state = 'open', state_changed_at = ?1, checked_by = NULL, checked_at = NULL,
            countersigned_by = NULL, evidence_link_id = NULL, evidence_text = NULL
      WHERE id = ?2`,
    [new Date().toISOString(), ctx.itemId],
  );
}

export async function countersign(
  ctx: ItemContext,
  actorId: string,
  role: StudioRole,
): Promise<void> {
  const verdict = mayCountersign(ctx, actorId, role);
  if (!verdict.ok) throw new NotPermitted(verdict.why);

  await appendEvent(ctx.itemId, "countersigned", actorId);
  await query(
    `UPDATE checklist_items
        SET state = 'countersigned', state_changed_at = ?1, countersigned_by = ?2
      WHERE id = ?3 AND checked_by != ?2`,
    [new Date().toISOString(), actorId, ctx.itemId],
  );
}

/**
 * Waiving is allowed, logged, and visible. A gate with no valve gets routed
 * around by people inventing fake deliverables, which destroys the data (§5b).
 */
export async function waive(
  ctx: ItemContext,
  actorId: string,
  reason: string,
): Promise<void> {
  if (!reason.trim()) {
    throw new NotPermitted("A waiver needs a reason — that’s what makes it a decision rather than a shortcut.");
  }
  await appendEvent(ctx.itemId, "waived", actorId, { reason: reason.trim() });
  await query(
    `UPDATE checklist_items
        SET state = 'waived', state_changed_at = ?1, waived_reason = ?2
      WHERE id = ?3`,
    [new Date().toISOString(), reason.trim(), ctx.itemId],
  );
}

/* -------------------------------------------------------------------------- */
/* Sending work to the client — where the gate is finally enforced (§5b)       */
/* -------------------------------------------------------------------------- */

export interface PublishCheck {
  ok: boolean;
  reasons: string[];
  hardBlocked: boolean;
  projectId: string;
  projectSlug: string;
  projectName: string;
  name: string;
  round: number;
  reviewUrl: string | null;
}

/**
 * Re-derives the gate from the database at write time.
 *
 * `canPublish` in lib/studio/logic.ts computes the same thing for the UI, but a
 * UI check is a courtesy. This is the one that decides, so a stale page or a
 * hand-made request cannot push unfinished work at a client.
 */
export async function publishCheck(deliverableId: string): Promise<PublishCheck | null> {
  const rows = await query<{
    name: string; status: string; current_round: number; project_id: string;
    project_slug: string; project_name: string; review_url: string | null;
    client_access_ok: number | null;
  }>(
    `SELECT d.name, d.status, d.current_round, d.project_id,
            p.slug AS project_slug, p.name AS project_name,
            l.url AS review_url, l.client_access_ok
       FROM deliverables d
       JOIN projects p ON p.id = d.project_id
       LEFT JOIN deliverable_versions v
              ON v.deliverable_id = d.id AND v.round = d.current_round
       LEFT JOIN links l ON l.id = v.review_link_id
      WHERE d.id = ?1 LIMIT 1`,
    [deliverableId],
  );
  const d = rows[0];
  if (!d) return null;

  const outstanding = await query<{ n: number; labels: string | null }>(
    `SELECT count(*) AS n, group_concat(i.label, ', ') AS labels
       FROM checklist_items i
       JOIN checklists c ON c.id = i.checklist_id
      WHERE c.deliverable_id = ?1
        AND i.is_applicable = 1
        AND i.is_required = 1
        AND (i.state = 'open' OR (i.state = 'checked' AND i.requires_countersign = 1))`,
    [deliverableId],
  );

  const reasons: string[] = [];
  let hardBlocked = false;

  // The one gate with no override: never show a client a link they can't open.
  if (!d.review_url) {
    reasons.push("There’s no review link on this round yet");
    hardBlocked = true;
  } else if (d.client_access_ok !== 1) {
    reasons.push("The review link isn’t verified as viewable by this client");
    hardBlocked = true;
  }

  const n = outstanding[0]?.n ?? 0;
  if (n > 0) {
    reasons.push(`${n} required checklist ${n === 1 ? "item" : "items"} outstanding: ${outstanding[0]?.labels ?? ""}`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
    hardBlocked,
    projectId: d.project_id,
    projectSlug: d.project_slug,
    projectName: d.project_name,
    name: d.name,
    round: d.current_round,
    reviewUrl: d.review_url,
  };
}

/** Moves a deliverable to the client, if the gate allows it. */
export async function sendToClient(
  deliverableId: string,
  actorId: string,
): Promise<PublishCheck> {
  const check = await publishCheck(deliverableId);
  if (!check) throw new NotPermitted("That deliverable has gone.");
  if (!check.ok) {
    throw new NotPermitted(
      check.hardBlocked
        ? `Can’t send this yet. ${check.reasons[0]} — and that one can’t be waived, because a link they can’t open is the only failure they experience directly.`
        : `Can’t send this yet. ${check.reasons.join("; ")}.`,
    );
  }

  const now = new Date().toISOString();
  await query(
    `UPDATE deliverables SET status = 'in_review', state_changed_at = ?1
      WHERE id = ?2 AND status IN ('draft','changes_requested')`,
    [now, deliverableId],
  );
  await query(
    `UPDATE deliverable_versions SET published_at = ?1, published_by = ?2
      WHERE deliverable_id = ?3 AND round = ?4`,
    [now, actorId, deliverableId, check.round],
  );
  await query(
    `INSERT INTO activity_events (project_id, actor_id, kind, subject_kind, subject_id, visibility)
     VALUES (?1, ?2, 'deliverable.in_review', 'deliverable', ?3, 'client')`,
    [check.projectId, actorId, deliverableId],
  );
  return check;
}

/* -------------------------------------------------------------------------- */
/* Publishing (§5c)                                                            */
/* -------------------------------------------------------------------------- */

export async function publishUpdate(
  projectId: string,
  actorId: string,
  body: string,
): Promise<void> {
  const text = body.trim();
  if (!text) throw new NotPermitted("There’s nothing to publish yet.");

  const now = new Date().toISOString();
  const health = await query<{ health: string }>(
    `SELECT health FROM projects WHERE id = ?1 LIMIT 1`,
    [projectId],
  );

  await query(
    `INSERT INTO updates (id, project_id, body, health_at_publish, status, published_by, published_at)
     VALUES (?1, ?2, ?3, ?4, 'published', ?5, ?6)`,
    [`upd_${Date.now().toString(36)}`, projectId, text, health[0]?.health ?? null, actorId, now],
  );
  await query(`UPDATE projects SET last_published_at = ?1 WHERE id = ?2`, [now, projectId]);
  await query(
    `INSERT INTO activity_events (project_id, actor_id, kind, subject_kind, subject_id, visibility)
     VALUES (?1, ?2, 'update.published', 'project', ?1, 'client')`,
    [projectId, actorId],
  );
}
