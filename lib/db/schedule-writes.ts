import "server-only";

import { query, rowsChanged } from "./d1.ts";
import { NotPermitted } from "./checklist-writes.ts";
import { randomToken } from "../auth/tokens.ts";

/**
 * Building a delivery schedule.
 *
 * A real website project is twenty-odd pages, each with its own date. Project
 * creation only ever instantiated deliverables from the project type's
 * template spine — fine for "Logo concepts, Icon set", useless for "Homepage,
 * About, Academics, Admissions…". Nobody was going to fill in twenty forms, so
 * in practice the schedule kept living in a spreadsheet.
 *
 * So the input here is the format people already have: lines of text, pasted.
 */

export interface ParsedLine {
  name: string;
  dueOn: string | null;
  /** Set when the line was understood but the date wasn't. */
  problem: string | null;
}

/**
 * Reads pasted lines into dated items.
 *
 * Accepts what a spreadsheet actually puts on the clipboard — tab-separated —
 * plus the comma form people type by hand, and no date at all. Dates are read
 * as ISO or US (`8/6/2026`), because that's what the sheet this replaces uses.
 *
 * It never silently drops a line. A line it can't fully read comes back with a
 * `problem` so the person can see and fix it, rather than discovering three
 * weeks later that the row was never created.
 */
export function parseScheduleLines(text: string, today = new Date()): ParsedLine[] {
  return text
    .split(/\r?\n/)
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => {
      const parts = raw.split(/\t|,(?=[^,]*$)/).map((p) => p.trim());
      const name = parts[0].replace(/\s+/g, " ");
      const rest = parts.slice(1).filter(Boolean).join(" ");

      if (!rest) return { name, dueOn: null, problem: null };

      const parsed = parseDate(rest, today);
      return parsed
        ? { name, dueOn: parsed, problem: null }
        : { name, dueOn: null, problem: `Couldn’t read “${rest}” as a date` };
    });
}

/**
 * ISO first, then US month/day/year.
 *
 * Rejects impossible dates rather than letting Date roll them over — the sheet
 * that prompted this had `8/30/20206` in it, and a silent correction to some
 * year in the future is worse than saying "that isn't a date".
 */
function parseDate(value: string, today: Date): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return valid(+iso[1], +iso[2], +iso[3]);

  const us = /^(\d{1,2})[/](\d{1,2})[/](\d{2}|\d{4})$/.exec(value);
  if (us) {
    let year = +us[3];
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return valid(year, +us[1], +us[2]);
  }

  const named = Date.parse(`${value} ${today.getFullYear()}`);
  if (!Number.isNaN(named)) {
    const d = new Date(named);
    return valid(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  return null;
}

function valid(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

export interface AddedItems {
  added: number;
  skipped: string[];
}

/**
 * Adds items to a project's schedule.
 *
 * They start as drafts, which is the truth — no work has been sent. Having a
 * date is what puts them on the client's schedule; see the visibility rule in
 * client-queries.ts. Nothing is published to anyone by adding a row.
 *
 * A name already on the project is skipped rather than duplicated, so pasting
 * a corrected list over the top adds the new lines instead of doubling
 * everything.
 */
export async function addScheduleItems(input: {
  projectId: string;
  actorId: string;
  lines: ParsedLine[];
  deliverableTypeId?: string | null;
}): Promise<AddedItems> {
  const usable = input.lines.filter((l) => l.name && !l.problem);
  if (usable.length === 0) {
    throw new NotPermitted("Nothing to add — paste one item per line.");
  }

  const existing = await query<{ name: string }>(
    `SELECT name FROM deliverables WHERE project_id = ?1`,
    [input.projectId],
  );
  const taken = new Set(existing.map((e) => e.name.toLowerCase()));

  // Names must be unique within the batch too — a pasted list often repeats.
  const skipped: string[] = [];
  const toAdd = usable.filter((line) => {
    const key = line.name.toLowerCase();
    if (taken.has(key)) {
      skipped.push(line.name);
      return false;
    }
    taken.add(key);
    return true;
  });

  const typeName = input.deliverableTypeId
    ? ((
        await query<{ name: string }>(`SELECT name FROM deliverable_types WHERE id = ?1 LIMIT 1`, [
          input.deliverableTypeId,
        ])
      )[0]?.name ?? "Page")
    : "Page";

  for (const line of toAdd) {
    await query(
      `INSERT INTO deliverables (id, project_id, deliverable_type_id, name, type_name,
                                 status, current_round, due_on)
       VALUES (?1, ?2, ?3, ?4, ?5, 'draft', 1, ?6)`,
      [
        `dlv_${randomToken(10)}`,
        input.projectId,
        input.deliverableTypeId ?? null,
        line.name,
        typeName,
        line.dueOn,
      ],
    );
  }

  if (toAdd.length > 0) {
    await query(
      `INSERT INTO activity_events (project_id, actor_id, kind, subject_kind, subject_id, visibility, payload)
       VALUES (?1, ?2, 'project.schedule_added', 'project', ?1, 'internal', ?3)`,
      [input.projectId, input.actorId, JSON.stringify({ added: toAdd.length })],
    );
  }

  return { added: toAdd.length, skipped };
}

/** Moving a single date, once the schedule exists. */
export async function setDueDate(input: {
  deliverableId: string;
  projectId: string;
  dueOn: string | null;
}): Promise<void> {
  await query(`UPDATE deliverables SET due_on = ?1 WHERE id = ?2 AND project_id = ?3`, [
    input.dueOn,
    input.deliverableId,
    input.projectId,
  ]);
  if (rowsChanged() === 0) {
    throw new NotPermitted("That item isn’t part of this project.");
  }
}
