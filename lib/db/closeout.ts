import "server-only";

import { query, run } from "./d1.ts";
import { NotPermitted } from "./checklist-writes.ts";

/**
 * Closing a project.
 *
 * This is the moment the SOP was built for: the checklist exists so that the
 * people who did the work confirm it's actually done before the project is.
 * Until now that was enforced per deliverable, at the point of sending work to
 * a client — nothing stood at the end of the project, which is where the
 * question "did we finish what we said we'd finish" actually gets asked.
 *
 * It warns rather than blocks. That's the settled rule everywhere except link
 * access: a gate that can't be passed gets worked around, and the studio ends
 * up tracking the truth somewhere else. So an unfinished project can still be
 * closed — the closer just has to say why, in writing, against their name, and
 * every outstanding item is copied into the record as it stood at that moment.
 * The log is what makes waivers visible later; refusing would only make them
 * invisible.
 */

export interface CloseoutBlocker {
  /** Short label — what kind of thing is outstanding. */
  kind: "deliverable" | "checklist" | "client" | "task";
  /** One line, readable by someone who wasn't on the project. */
  summary: string;
  /** The specific items, for the record and for the person deciding. */
  items: string[];
}

export interface CloseoutCheck {
  ok: boolean;
  blockers: CloseoutBlocker[];
  projectId: string;
  name: string;
  slug: string;
  status: string;
}

/**
 * What's still outstanding on a project, in the order it matters.
 *
 * Deliverables first: a project is its deliverables. Then the SOP, then what
 * we owe the client, then internal tasks — cheapest to dismiss last.
 */
export async function closeoutCheck(projectId: string): Promise<CloseoutCheck | null> {
  const projects = await query<{ id: string; name: string; slug: string; status: string }>(
    `SELECT id, name, slug, status FROM projects WHERE id = ?1 LIMIT 1`,
    [projectId],
  );
  const project = projects[0];
  if (!project) return null;

  const [deliverables, checklist, client, tasks] = await Promise.all([
    query<{ name: string; status: string }>(
      `SELECT name, status FROM deliverables
        WHERE project_id = ?1 AND status NOT IN ('approved','delivered')
        ORDER BY name`,
      [projectId],
    ),
    // Same definition of "settled" as the publish gate: waived counts, and an
    // item needing a countersign isn't done until it has one.
    query<{ label: string; deliverable: string }>(
      `SELECT i.label, d.name AS deliverable
         FROM checklist_items i
         JOIN checklists c ON c.id = i.checklist_id
         LEFT JOIN deliverables d ON d.id = c.deliverable_id
        WHERE c.project_id = ?1
          AND i.is_applicable = 1
          AND i.is_required = 1
          AND (i.state = 'open' OR (i.state = 'checked' AND i.requires_countersign = 1))
        ORDER BY d.name, i.position`,
      [projectId],
    ),
    query<{ title: string; status: string }>(
      `SELECT title, status FROM client_actions
        WHERE project_id = ?1 AND status != 'accepted' ORDER BY created_at`,
      [projectId],
    ),
    query<{ title: string }>(
      `SELECT title FROM tasks WHERE project_id = ?1 AND status != 'done' ORDER BY title`,
      [projectId],
    ),
  ]);

  const blockers: CloseoutBlocker[] = [];

  if (deliverables.length > 0) {
    blockers.push({
      kind: "deliverable",
      summary: `${count(deliverables.length, "deliverable")} not approved yet`,
      items: deliverables.map((d) => `${d.name} — ${readableStatus(d.status)}`),
    });
  }

  if (checklist.length > 0) {
    blockers.push({
      kind: "checklist",
      summary: `${count(checklist.length, "checklist item")} outstanding`,
      items: checklist.map((i) => (i.deliverable ? `${i.deliverable}: ${i.label}` : i.label)),
    });
  }

  if (client.length > 0) {
    blockers.push({
      kind: "client",
      summary: `${count(client.length, "thing")} still open with the client`,
      items: client.map(
        (c) => `${c.title} — ${c.status === "open" ? "waiting on them" : "they replied, not accepted yet"}`,
      ),
    });
  }

  if (tasks.length > 0) {
    blockers.push({
      kind: "task",
      summary: `${count(tasks.length, "task")} not done`,
      items: tasks.map((t) => t.title),
    });
  }

  return {
    ok: blockers.length === 0,
    blockers,
    projectId: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status,
  };
}

/**
 * Marks a project done.
 *
 * `note` is required when anything is outstanding — the same argument as
 * setHealth: a state change without a reason tells whoever reads it later that
 * something happened, and nothing about whether it was fine.
 */
export async function closeProject(input: {
  projectId: string;
  actorId: string;
  note: string;
}): Promise<CloseoutCheck> {
  const check = await closeoutCheck(input.projectId);
  if (!check) throw new NotPermitted("That project has gone.");
  if (check.status === "done") {
    throw new NotPermitted("That project is already closed.");
  }

  const note = input.note.trim();
  if (!check.ok && !note) {
    throw new NotPermitted(
      "Some of this isn’t finished. You can still close it — say why in a sentence, " +
        "so the next person reading this knows it was a decision and not an oversight.",
    );
  }

  const changed = await run(
    `UPDATE projects SET status = 'done', actual_end_on = date('now')
      WHERE id = ?1 AND status != 'done'`,
    [input.projectId],
  );
  if (changed === 0) {
    throw new NotPermitted("Someone else closed it while you were looking.");
  }

  // Two events, because they are read by different people.
  //
  // The client-visible one says the project closed and why, and carries
  // nothing else. The snapshot of what was outstanding is internal: it is
  // built from `tasks` and `checklist_items`, both INTERNAL_ONLY, and tagging
  // it 'client' would mean the first client-facing activity feed anyone builds
  // inherits a leak that no query today would catch.
  await query(
    `INSERT INTO activity_events (project_id, actor_id, kind, subject_kind, subject_id, visibility, payload)
     VALUES (?1, ?2, 'project.closed', 'project', ?1, 'client', ?3)`,
    [input.projectId, input.actorId, JSON.stringify({ note: note || null, clean: check.ok })],
  );
  // Copied in as it stood, not referenced — the rows it came from keep
  // changing, and the record of what someone signed off must not.
  await query(
    `INSERT INTO activity_events (project_id, actor_id, kind, subject_kind, subject_id, visibility, payload)
     VALUES (?1, ?2, 'project.closed_snapshot', 'project', ?1, 'internal', ?3)`,
    [input.projectId, input.actorId, JSON.stringify({ outstanding: check.blockers })],
  );

  return check;
}

/** Closed too early, or work came back. */
export async function reopenProject(input: {
  projectId: string;
  actorId: string;
  note: string;
}): Promise<void> {
  const note = input.note.trim();
  if (!note) {
    throw new NotPermitted("Say why it’s reopening — the client can see this happen.");
  }

  const changed = await run(
    `UPDATE projects SET status = 'active', actual_end_on = NULL
      WHERE id = ?1 AND status = 'done'`,
    [input.projectId],
  );
  if (changed === 0) {
    throw new NotPermitted("That project isn’t closed.");
  }

  await query(
    `INSERT INTO activity_events (project_id, actor_id, kind, subject_kind, subject_id, visibility, payload)
     VALUES (?1, ?2, 'project.reopened', 'project', ?1, 'client', ?3)`,
    [input.projectId, input.actorId, JSON.stringify({ note })],
  );
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function readableStatus(status: string): string {
  return (
    {
      draft: "not sent yet",
      in_review: "with the client",
      changes_requested: "changes asked for",
    }[status] ?? status.replace(/_/g, " ")
  );
}
