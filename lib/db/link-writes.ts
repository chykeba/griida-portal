import "server-only";

import { query, run } from "./d1.ts";
import { NotPermitted } from "./checklist-writes.ts";
import { randomToken } from "../auth/tokens.ts";

/**
 * Review links, and the one gate that cannot be waived (§5b, §3c).
 *
 * There are two different questions here and conflating them would make the
 * gate a lie:
 *
 *  1. **Is the link reachable?** Answerable by machine. A fetch catches typos,
 *     deleted files and dead staging URLs. This can only ever *disprove* a
 *     link — a 200 means the URL exists, nothing more.
 *
 *  2. **Can this particular client open it?** Not answerable by machine.
 *     Figma and Drive return 200 to anyone and then show "you need access"
 *     inside the app. Verifying that properly would need OAuth against each
 *     provider as the client, which we do not have.
 *
 * So the second is a human attestation, recorded with who said it and when,
 * exactly like a checklist tick. Pretending a fetch had confirmed sharing
 * would be worse than asking — the client hitting a permission wall is the
 * failure this gate exists to prevent.
 */

export interface SetLinkInput {
  deliverableId: string;
  url: string;
  label: string;
  provider: string;
  bestOnDesktop: boolean;
  actorId: string;
}

/** Attaches (or replaces) the review link on the deliverable's current round. */
export async function setReviewLink(input: SetLinkInput): Promise<string> {
  const url = input.url.trim();
  if (!/^https?:\/\/\S+\.\S+/.test(url)) {
    throw new NotPermitted("That doesn’t look like a link. It needs to start with https://");
  }

  const rows = await query<{ current_round: number; name: string }>(
    `SELECT current_round, name FROM deliverables WHERE id = ?1 LIMIT 1`,
    [input.deliverableId],
  );
  const deliverable = rows[0];
  if (!deliverable) throw new NotPermitted("That deliverable has gone.");

  const linkId = `lnk_${input.deliverableId}_r${deliverable.current_round}`;

  // Replacing the link resets the access attestation. Someone confirming a
  // *previous* URL was shared says nothing about this one, and carrying the
  // tick over would let a new link slip past the gate unverified.
  await query(
    `INSERT OR REPLACE INTO links
       (id, url, label, provider, added_by, best_on_desktop, client_access_ok, access_checked_at, health)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, NULL, 'unknown')`,
    [linkId, url, input.label.trim() || deliverable.name, input.provider,
     input.actorId, input.bestOnDesktop ? 1 : 0],
  );

  const version = await query<{ id: string }>(
    `SELECT id FROM deliverable_versions WHERE deliverable_id = ?1 AND round = ?2 LIMIT 1`,
    [input.deliverableId, deliverable.current_round],
  );

  if (version[0]) {
    await query(`UPDATE deliverable_versions SET review_link_id = ?1 WHERE id = ?2`, [
      linkId,
      version[0].id,
    ]);
  } else {
    await query(
      `INSERT INTO deliverable_versions (id, deliverable_id, round, review_link_id)
       VALUES (?1, ?2, ?3, ?4)`,
      [`dv_${randomToken(8)}`, input.deliverableId, deliverable.current_round, linkId],
    );
  }

  return linkId;
}

export interface ReachResult {
  reachable: boolean;
  status: number | null;
  note: string;
}

/**
 * Fetches the link to see whether it resolves at all.
 *
 * Deliberately modest about what it proves. A 200 means the URL exists; it
 * does not mean the client can see the contents. A 404 or a network error is
 * genuinely useful though — that link was going to fail for everyone.
 */
export async function checkReachable(linkId: string): Promise<ReachResult> {
  const rows = await query<{ url: string }>(`SELECT url FROM links WHERE id = ?1 LIMIT 1`, [linkId]);
  const url = rows[0]?.url;
  if (!url) throw new NotPermitted("That link has gone.");

  let status: number | null = null;
  let reachable = false;
  let note = "";

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    status = response.status;
    reachable = response.status < 400;
    note = reachable
      ? "The URL resolves. Whether this client can see the contents is a separate question."
      : `The URL returned ${response.status} — it would fail for them too.`;
  } catch (error) {
    note =
      error instanceof Error && error.name === "TimeoutError"
        ? "The URL didn’t respond in time. It may be fine, or it may be down."
        : "Couldn’t reach that URL at all.";
  }

  const health = reachable ? "ok" : status === 403 ? "forbidden" : "unreachable";
  await query(
    `INSERT INTO link_checks (link_id, http_status, result, note) VALUES (?1, ?2, ?3, ?4)`,
    [linkId, status, health, note],
  );
  await query(`UPDATE links SET health = ?1, last_checked_at = datetime('now') WHERE id = ?2`, [
    health,
    linkId,
  ]);

  return { reachable, status, note };
}

/**
 * The human half: someone confirms this client can actually open it.
 *
 * Recorded with who and when, because this is the single assertion standing
 * between a client and a permission wall — the one failure §5b says they
 * experience directly, and the only gate with no override.
 */
export async function attestClientAccess(
  linkId: string,
  actorId: string,
  confirmed: boolean,
  projectId: string,
): Promise<void> {
  // Scoped to the project the actor is actually standing in. A link id is a
  // bare opaque string in the form; without this, one project’s lead could
  // flip the access gate on another project’s review link and unblock a send
  // they never looked at. Links have no project column, so we reach them
  // through the two places a project can hold one.
  const changed = await run(
    `UPDATE links
        SET client_access_ok = ?1, access_checked_at = datetime('now'),
            added_by = COALESCE(added_by, ?2)
      WHERE id = ?3
        AND (
          EXISTS (SELECT 1 FROM deliverable_versions v
                    JOIN deliverables d ON d.id = v.deliverable_id
                   WHERE v.review_link_id = ?3 AND d.project_id = ?4)
          OR EXISTS (SELECT 1 FROM project_documents pd
                      WHERE pd.link_id = ?3 AND pd.project_id = ?4)
        )`,
    [confirmed ? 1 : 0, actorId, linkId, projectId],
  );
  if (changed === 0) {
    throw new Error("That link isn’t part of this project.");
  }
}

export async function reviewLinkFor(deliverableId: string) {
  const rows = await query<{
    id: string; url: string; label: string; provider: string;
    best_on_desktop: number; client_access_ok: number | null; health: string;
    last_checked_at: string | null; access_checked_at: string | null;
  }>(
    `SELECT l.id, l.url, l.label, l.provider, l.best_on_desktop, l.client_access_ok,
            l.health, l.last_checked_at, l.access_checked_at
       FROM deliverables d
       JOIN deliverable_versions v ON v.deliverable_id = d.id AND v.round = d.current_round
       JOIN links l ON l.id = v.review_link_id
      WHERE d.id = ?1 LIMIT 1`,
    [deliverableId],
  );
  return rows[0] ?? null;
}
