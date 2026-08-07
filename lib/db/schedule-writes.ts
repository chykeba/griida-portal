import "server-only";

import { query, run } from "./d1.ts";
import { NotPermitted } from "./checklist-writes.ts";

/** Bad input, not a permission problem — worth separating so the UI can say so. */
export class BadInput extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadInput";
  }
}
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
      // A tab is unambiguous: name, then date. A comma is not — "Business, Law
      // & Education" is one name, and splitting it produced "Business" on a
      // real client's schedule. So the comma only separates a date when what
      // follows actually reads as one; otherwise the line is all name.
      let name = raw;
      let rest = "";

      if (raw.includes("\t")) {
        const [first, ...tail] = raw.split("\t");
        name = first.trim();
        rest = tail.join(" ").trim();
      } else {
        const comma = raw.lastIndexOf(",");
        if (comma !== -1 && parseDate(raw.slice(comma + 1).trim(), today)) {
          name = raw.slice(0, comma).trim();
          rest = raw.slice(comma + 1).trim();
        }
      }

      name = name.replace(/\s+/g, " ").trim();

      // Must contain something nameable. A line of stray punctuation left over
      // from a paste was coming through as an item literally called ",".
      if (!/[\p{L}\p{N}]/u.test(name)) {
        return {
          name,
          dueOn: null,
          problem: "That line has no name — just a date or a stray separator",
        };
      }
      // A bare date on its own line is someone's paste going wrong, not an
      // item called "2026-09-02".
      if (!rest && parseDate(name, today)) {
        return { name, dueOn: null, problem: "That line is a date with nothing to attach it to" };
      }
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

  // Month names, matched explicitly. This used to fall through to Date.parse,
  // whose legacy path silently discards words it doesn't recognise and keeps
  // the year — so "TBD", "ASAP" and "when ready" all came back as 1 January,
  // problem-free. On a column that decides whether a client sees the row, that
  // turned the commonest placeholder in a schedule into a public commitment
  // already months overdue.
  const named = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/.exec(value);
  if (named) {
    const month = MONTHS.indexOf(named[1].slice(0, 3).toLowerCase());
    if (month !== -1) return valid(named[3] ? +named[3] : today.getFullYear(), month + 1, +named[2]);
  }

  // The same, day first: "6 August".
  const dayFirst = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?(?:,?\s+(\d{4}))?$/.exec(value);
  if (dayFirst) {
    const month = MONTHS.indexOf(dayFirst[2].slice(0, 3).toLowerCase());
    if (month !== -1) {
      return valid(dayFirst[3] ? +dayFirst[3] : today.getFullYear(), month + 1, +dayFirst[1]);
    }
  }

  return null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

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
/**
 * A paste this long is a mistake, not a schedule. The cap exists because every
 * row is a client-visible commitment and there is no transaction to undo a
 * half-written one.
 */
export const MAX_ITEMS = 200;
const MAX_NAME = 200;

export async function addScheduleItems(input: {
  projectId: string;
  actorId: string;
  lines: ParsedLine[];
  deliverableTypeId?: string | null;
}): Promise<AddedItems> {
  const usable = input.lines.filter((l) => l.name && !l.problem);
  if (usable.length === 0) {
    throw new BadInput("Nothing to add — paste one item per line.");
  }
  if (usable.length > MAX_ITEMS) {
    throw new BadInput(
      `That’s ${usable.length} items. ${MAX_ITEMS} is the most in one go — split it up.`,
    );
  }
  const tooLong = usable.find((l) => l.name.length > MAX_NAME);
  if (tooLong) {
    throw new BadInput(`“${tooLong.name.slice(0, 40)}…” is too long to be an item name.`);
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

  // One statement, not one per row. Every query here is an HTTP round trip to
  // Cloudflare (see d1.ts) — twenty pages was twenty sequential hops, and with
  // no transactions a failure at item twelve left half a schedule live on the
  // client's plan with nothing recording that it happened.
  if (toAdd.length > 0) {
    const values: string[] = [];
    const params: unknown[] = [];
    for (const line of toAdd) {
      const n = params.length;
      values.push(`(?${n + 1}, ?${n + 2}, ?${n + 3}, ?${n + 4}, ?${n + 5}, 'draft', 1, ?${n + 6})`);
      params.push(
        `dlv_${randomToken(10)}`,
        input.projectId,
        input.deliverableTypeId ?? null,
        line.name,
        typeName,
        line.dueOn,
      );
    }
    await query(
      `INSERT INTO deliverables (id, project_id, deliverable_type_id, name, type_name,
                                 status, current_round, due_on)
       VALUES ${values.join(", ")}`,
      params,
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
  actorId: string;
}): Promise<void> {
  // `<input type="date">` is a client-side courtesy, not a guarantee — a server
  // action accepts any POST. And this column decides whether the client sees
  // the row and where it sorts, so junk here corrupts the plan rather than
  // just this field.
  const dueOn = input.dueOn?.trim() || null;
  if (dueOn !== null && dueOn !== normaliseDate(dueOn)) {
    throw new BadInput("That isn’t a date. Use the picker, or clear it.");
  }

  const changed = await run(`UPDATE deliverables SET due_on = ?1 WHERE id = ?2 AND project_id = ?3`, [
    dueOn,
    input.deliverableId,
    input.projectId,
  ]);
  if (changed === 0) {
    throw new NotPermitted("That item isn’t part of this project.");
  }

  // Moving a date the client can see is a state change like any other, and
  // every other one in this codebase carries an author.
  await query(
    `INSERT INTO activity_events (project_id, actor_id, kind, subject_kind, subject_id, visibility, payload)
     VALUES (?1, ?2, 'deliverable.date_changed', 'deliverable', ?3, 'internal', ?4)`,
    [input.projectId, input.actorId, input.deliverableId, JSON.stringify({ dueOn })],
  );
}

/** ISO or nothing. Shares `valid()` so both paths agree on what a date is. */
function normaliseDate(value: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return iso ? valid(+iso[1], +iso[2], +iso[3]) : null;
}
