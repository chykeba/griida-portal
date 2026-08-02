/**
 * THE PUBLISH BOUNDARY — table classification.
 *
 * On Postgres this was RLS: internal tables had no client policy at all, so
 * application code physically could not leak them. D1 is SQLite and has no
 * row-level security, so the boundary lives here instead.
 *
 * That is a genuine downgrade — it is enforced by code and tests rather than by
 * the engine. These three things keep it honest:
 *
 *   1. Every table is classified below. `boundary.test.ts` fails if a table
 *      exists in the migration and isn't listed here, so adding a table forces
 *      a decision about who can see it.
 *   2. Client-facing SQL lives only in `client-queries.ts`, and a test scans
 *      that file for table names, failing if any INTERNAL table appears.
 *   3. `queryAsClient()` re-checks at runtime, catching anything assembled
 *      dynamically that the static scan couldn't see.
 *
 * If you are tempted to read an internal table on a client path: don't. Project
 * the value you need onto a client-readable table at write time instead.
 */

/** Readable by a signed-in client, subject to the scoping in client-queries. */
export const CLIENT_READABLE = [
  "studios",
  "users", // only ever the caller's own row — see client-queries
  "client_accounts",
  "account_members",
  "links",
  "brand_library_items",
  "projects",
  "project_client_roles",
  "milestones",
  "deliverables",
  "deliverable_versions",
  "client_actions",
  "updates",
  "reviews",
  "feedback_comments",
  "decisions",
  "project_documents",
  "notifications",
  // Readable at COLUMN level only — see FORBIDDEN_CLIENT_COLUMNS below. The
  // client is shown which checks passed, never who ticked them, on what
  // evidence, or what was waived.
  "checklists",
  "checklist_items",
] as const;

/**
 * Never reachable on a client path. Tasks, who is blocking whom, checklist
 * evidence, waivers, draft updates, read receipts, link diagnostics.
 */
export const INTERNAL_ONLY = [
  "auth_tokens",
  "sessions",
  "link_checks",
  "project_types",
  "milestone_templates",
  "deliverable_types",
  "checklist_templates",
  "checklist_template_items",
  "checklist_item_events",
  "project_team",
  "tasks",
  "task_blockers",
  "activity_events",
  "update_reads",
  "revision_requests",
] as const;

export type ClientReadableTable = (typeof CLIENT_READABLE)[number];

/**
 * Columns a client query may never select, even on a client-readable table.
 *
 * `checklists` and `checklist_items` carry two different things: a delivery
 * standard the client is entitled to see, and an internal accountability
 * record they are not. Table-level classification can't express that, so the
 * columns are named here and `boundary.test.ts` enforces it.
 */
export const FORBIDDEN_CLIENT_COLUMNS = [
  "checked_by",
  "checked_at",
  "countersigned_by",
  "evidence_link_id",
  "evidence_text",
  "waived_reason",
  "source_template_id",
] as const;

const CLIENT_SET: ReadonlySet<string> = new Set(CLIENT_READABLE);
const INTERNAL_SET: ReadonlySet<string> = new Set(INTERNAL_ONLY);

export function isClientReadable(table: string): boolean {
  return CLIENT_SET.has(table);
}

export function isInternalOnly(table: string): boolean {
  return INTERNAL_SET.has(table);
}

export function allClassifiedTables(): string[] {
  return [...CLIENT_READABLE, ...INTERNAL_ONLY].sort();
}

/**
 * Extracts table names a statement touches. Deliberately over-broad: it looks
 * for every classified table name appearing as a word anywhere in the SQL, so
 * it errs towards false positives. A false positive is a failing test; a false
 * negative is a client reading internal data.
 */
export function tablesReferenced(sql: string): string[] {
  const withoutStrings = sql.replace(/'[^']*'/g, "''");
  const found = new Set<string>();
  for (const table of allClassifiedTables()) {
    if (new RegExp(`\\b${table}\\b`).test(withoutStrings)) found.add(table);
  }
  return [...found].sort();
}

/** Throws if a statement intended for a client path touches internal data. */
export function assertClientSafe(sql: string, context = "query"): void {
  const offending = tablesReferenced(sql).filter(isInternalOnly);
  if (offending.length > 0) {
    throw new Error(
      `Publish boundary violation in ${context}: ` +
        `client-path SQL referenced internal ${offending.length === 1 ? "table" : "tables"} ` +
        `${offending.join(", ")}. Internal data must never be reachable from a client ` +
        `request — project what you need onto a client-readable table at write time.`,
    );
  }
}
