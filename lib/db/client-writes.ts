import "server-only";

import { query, run } from "./d1.ts";
import { randomToken } from "../auth/tokens.ts";

/**
 * The work moved between the page loading and the client deciding.
 *
 * Distinct from a failure, because nothing went wrong and "try again" is the
 * wrong advice — someone should look at where it stands now.
 */
export class NotCurrent extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotCurrent";
  }
}

/**
 * The client's only writes: approve, or ask for changes.
 *
 * Every statement re-derives the deliverable through `project_client_roles`
 * rather than trusting the id it was handed. A client posting someone else's
 * deliverable id changes nothing — the UPDATE matches no rows.
 *
 * These use `query()` rather than `queryAsClient()` because a write legitimately
 * touches internal tables (activity_events, revision_requests). The guard that
 * matters here is the ownership check in the WHERE clause, which is asserted in
 * client-writes.test.ts.
 */

export interface ReviewContext {
  deliverableId: string;
  projectId: string;
  name: string;
  currentRound: number;
  roundsIncluded: number;
  versionId: string | null;
}

/** Resolves a deliverable the caller actually has a role on, or null. */
export async function reviewableForUser(
  userId: string,
  deliverableId: string,
): Promise<ReviewContext | null> {
  const rows = await query<{
    id: string;
    project_id: string;
    name: string;
    current_round: number;
    rounds_included: number;
    version_id: string | null;
  }>(
    `SELECT d.id, d.project_id, d.name, d.current_round,
            p.rounds_included, v.id AS version_id
       FROM deliverables d
       JOIN projects p ON p.id = d.project_id
       JOIN project_client_roles r ON r.project_id = d.project_id
       LEFT JOIN deliverable_versions v
              ON v.deliverable_id = d.id AND v.round = d.current_round
      WHERE r.user_id = ?1
        AND d.id = ?2
        AND d.status = 'in_review'
      LIMIT 1`,
    [userId, deliverableId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    deliverableId: row.id,
    projectId: row.project_id,
    name: row.name,
    currentRound: row.current_round,
    roundsIncluded: row.rounds_included,
    versionId: row.version_id,
  };
}

/**
 * Is the round the client is about to trigger beyond what they've paid for?
 *
 * Requesting changes on round N produces round N+1. If that exceeds the
 * included rounds, the *next* round is billable — which is what the client is
 * told, before they commit to it (§5).
 */
export function nextRoundIsBillable(ctx: ReviewContext): boolean {
  return ctx.currentRound + 1 > ctx.roundsIncluded;
}

/**
 * Records a decision against the current version.
 *
 * A pending `reviews` row normally exists because the studio created one when
 * it published the round — but the client's decision must not depend on that
 * having happened, or a decision silently vanishes. So: update the pending row
 * if there is one, otherwise write the decision as a new row.
 */
async function recordDecision(
  versionId: string,
  round: number,
  userId: string,
  decision: "approved" | "changes_requested",
  note: string | null,
  at: string,
): Promise<void> {
  const pending = await query<{ id: string }>(
    `SELECT id FROM reviews WHERE version_id = ?1 AND decision = 'pending' LIMIT 1`,
    [versionId],
  );

  if (pending[0]) {
    await query(
      `UPDATE reviews SET decision = ?1, decided_by = ?2, decided_at = ?3, decision_note = ?4
        WHERE id = ?5`,
      [decision, userId, at, note, pending[0].id],
    );
    return;
  }

  await query(
    `INSERT INTO reviews (id, version_id, round, decision, requested_at, decided_by, decided_at, decision_note)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?5, ?7)`,
    [`rev_${randomToken(8)}`, versionId, round, decision, at, userId, note],
  );
}

export async function approve(
  userId: string,
  ctx: ReviewContext,
  note: string | null,
): Promise<void> {
  const now = new Date().toISOString();

  // Ownership and state are re-checked here, not assumed from ctx, and this
  // runs BEFORE anything is recorded. The WHERE clause is the authorisation:
  // right deliverable, still in review, and this client actually on it.
  const changed = await run(
    `UPDATE deliverables
        SET status = 'approved', state_changed_at = ?1
      WHERE id = ?2
        AND status = 'in_review'
        AND project_id IN (SELECT project_id FROM project_client_roles WHERE user_id = ?3)`,
    [now, ctx.deliverableId, userId],
  );
  if (changed === 0) {
    throw new NotCurrent(
      "This isn’t waiting on you any more — have another look at where it stands.",
    );
  }

  if (ctx.versionId) {
    await recordDecision(ctx.versionId, ctx.currentRound, userId, "approved", note, now);
  }

  await query(
    `INSERT INTO activity_events (project_id, actor_id, kind, subject_kind, subject_id, visibility)
     VALUES (?1, ?2, 'review.approved', 'deliverable', ?3, 'client')`,
    [ctx.projectId, userId, ctx.deliverableId],
  );
}

export async function requestChanges(
  userId: string,
  ctx: ReviewContext,
  notes: string,
): Promise<{ billable: boolean }> {
  const now = new Date().toISOString();
  const billable = nextRoundIsBillable(ctx);

  // The guarded UPDATE goes first, and everything else hangs off whether it
  // applied. It used to run third, after the feedback comment and with the
  // billable revision request behind it — so a request against something not
  // actually in review still wrote a comment and still raised a priced
  // revision, on work the client had never been sent. The WHERE clause here is
  // the authorisation: right deliverable, right state, right person.
  const changed = await run(
    `UPDATE deliverables
        SET status = 'changes_requested', state_changed_at = ?1
      WHERE id = ?2
        AND status = 'in_review'
        AND project_id IN (SELECT project_id FROM project_client_roles WHERE user_id = ?3)`,
    [now, ctx.deliverableId, userId],
  );
  if (changed === 0) {
    throw new NotCurrent(
      "This isn’t waiting on your notes any more — have another look at where it stands.",
    );
  }

  if (ctx.versionId) {
    await recordDecision(ctx.versionId, ctx.currentRound, userId, "changes_requested", notes, now);
    await query(
      `INSERT INTO feedback_comments (id, version_id, author_id, body, source)
       VALUES (?1, ?2, ?3, ?4, 'portal')`,
      [`fb_${randomToken(8)}`, ctx.versionId, userId, notes],
    );
  }

  // Beyond the included rounds, the request becomes a priced decision rather
  // than silent extra work (§5). Deliberately not a block: the studio sees it,
  // prices it, and turns it into an invoice — the client is simply told.
  if (billable) {
    await query(
      `INSERT INTO revision_requests (id, project_id, deliverable_id, description, status)
       VALUES (?1, ?2, ?3, ?4, 'proposed')`,
      [`rr_${randomToken(8)}`, ctx.projectId, ctx.deliverableId, notes],
    );
  }

  await query(
    `INSERT INTO activity_events (project_id, actor_id, kind, subject_kind, subject_id, visibility, payload)
     VALUES (?1, ?2, 'review.changes_requested', 'deliverable', ?3, 'client', ?4)`,
    [ctx.projectId, userId, ctx.deliverableId, JSON.stringify({ billable })],
  );

  return { billable };
}

/* -------------------------------------------------------------------------- */
/* Responding to "waiting on you" (§5A)                                       */
/* -------------------------------------------------------------------------- */

/**
 * The client answers a request.
 *
 * Scoped through project_client_roles in the UPDATE itself, like every other
 * client write here — posting someone else's action id changes nothing.
 *
 * A response is a link or a note, because the portal stores no files (§3c).
 * The wording asks for a link rather than an upload, so the constraint reads
 * as a choice instead of a missing feature.
 */
export async function respondToAction(
  userId: string,
  actionId: string,
  response: { url?: string | null; text?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const url = response.url?.trim();
  const text = response.text?.trim();
  if (!url && !text) {
    return { ok: false, error: "Add a link or a note so we know what to work from." };
  }
  if (url && !/^https?:\/\/\S+\.\S+/.test(url)) {
    return { ok: false, error: "That doesn’t look like a link. It needs to start with https://" };
  }

  // Ownership and state are resolved BEFORE anything is written. Previously the
  // link row went in first, using an id derived from caller input — so a client
  // could create or overwrite the response link on a request belonging to a
  // project they had no role on, and the studio would read the attacker's URL
  // as that client's answer.
  const owned = await query<{ project_id: string; status: string }>(
    `SELECT c.project_id, c.status
       FROM client_actions c
       JOIN project_client_roles r ON r.project_id = c.project_id
      WHERE c.id = ?1 AND r.user_id = ?2
      LIMIT 1`,
    [actionId, userId],
  );
  if (!owned[0]) {
    return { ok: false, error: "We can’t find that request — it may have been withdrawn." };
  }
  // Branch on the state as it is NOW, not on a re-read afterwards. A re-read
  // can't tell "I just submitted this" from "it was already submitted", which
  // is why a double-submit used to report success and discard the answer.
  if (owned[0].status !== "open") {
    return { ok: false, error: "That one’s already been answered." };
  }

  let linkId: string | null = null;
  if (url) {
    linkId = `lnk_resp_${actionId}`;
    await query(
      `INSERT INTO links (id, url, label, provider, added_by, client_access_ok)
       VALUES (?1, ?2, 'Client response', 'other', ?3, 1)
       ON CONFLICT(id) DO UPDATE SET url = excluded.url, added_by = excluded.added_by`,
      [linkId, url, userId],
    );
  }

  const changed = await run(
    `UPDATE client_actions
        SET status = 'submitted', submitted_at = datetime('now'),
            response_link_id = ?1, response_text = ?2
      WHERE id = ?3
        AND status = 'open'
        AND project_id IN (SELECT project_id FROM project_client_roles WHERE user_id = ?4)`,
    [linkId, text ?? null, actionId, userId],
  );
  if (changed === 0) {
    // Lost a race with another submission between the check and the write.
    return { ok: false, error: "That one’s already been answered." };
  }

  await query(
    `INSERT INTO activity_events (project_id, actor_id, kind, subject_kind, subject_id, visibility)
     VALUES (?1, ?2, 'client_action.submitted', 'client_action', ?3, 'client')`,
    [owned[0].project_id, userId, actionId],
  );
  return { ok: true };
}
