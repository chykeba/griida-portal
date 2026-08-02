/**
 * The publish boundary, tested.
 *
 * On Postgres these guarantees came from RLS and needed no tests — the engine
 * could not be talked out of them. On D1 they are ours to hold, so they are
 * asserted here. If you are changing this file to make a build pass, stop and
 * reconsider what you are about to ship.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  CLIENT_READABLE,
  FORBIDDEN_CLIENT_COLUMNS,
  INTERNAL_ONLY,
  allClassifiedTables,
  assertClientSafe,
  isInternalOnly,
  tablesReferenced,
} from "./tables.ts";

const CLIENT_QUERIES = path.join(import.meta.dirname, "client-queries.ts");
const MIGRATION = path.join(import.meta.dirname, "../../db/migrations/0001_init.sql");

/** Table names actually created by the migration. */
function tablesInMigration(): string[] {
  const sql = fs.readFileSync(MIGRATION, "utf8");
  return [...sql.matchAll(/CREATE TABLE (\w+)/gi)].map((m) => m[1]).sort();
}

test("every table in the migration is classified as client-readable or internal", () => {
  const created = tablesInMigration();
  const classified = new Set(allClassifiedTables());
  const unclassified = created.filter((t) => !classified.has(t));
  assert.deepEqual(
    unclassified,
    [],
    `Unclassified ${unclassified.length === 1 ? "table" : "tables"}: ${unclassified.join(", ")}. ` +
      `Add each to CLIENT_READABLE or INTERNAL_ONLY in tables.ts — adding a table ` +
      `must force a decision about who can see it.`,
  );
});

test("no table is classified as both readable and internal", () => {
  const overlap = CLIENT_READABLE.filter((t) => (INTERNAL_ONLY as readonly string[]).includes(t));
  assert.deepEqual(overlap, []);
});

test("classification doesn't drift from the migration", () => {
  const created = new Set(tablesInMigration());
  const phantom = allClassifiedTables().filter((t) => !created.has(t));
  assert.deepEqual(phantom, [], `Classified but not in the migration: ${phantom.join(", ")}`);
});

/* -------------------------------------------------------------------------- */
/* The one that matters                                                       */
/* -------------------------------------------------------------------------- */

test("no client-facing SQL references an internal table", () => {
  const source = fs.readFileSync(CLIENT_QUERIES, "utf8");

  // Only look inside template literals — the SQL — so prose in comments
  // mentioning a table name can't fail the build.
  const statements = [...source.matchAll(/`([^`]*(?:SELECT|INSERT|UPDATE|DELETE)[^`]*)`/gi)]
    .map((m) => m[1]);

  assert.ok(statements.length > 0, "found no SQL to check — has the file moved?");

  for (const sql of statements) {
    const offending = tablesReferenced(sql).filter(isInternalOnly);
    assert.deepEqual(
      offending,
      [],
      `Client-path SQL touches internal ${offending.join(", ")}:\n${sql.trim().slice(0, 200)}`,
    );
  }
});

test("every client query is scoped to the calling user, not just an id from the URL", () => {
  const source = fs.readFileSync(CLIENT_QUERIES, "utf8");
  const statements = [...source.matchAll(/`([^`]*SELECT[^`]*)`/gi)].map((m) => m[1]);

  for (const sql of statements) {
    const scoped =
      /r\.user_id\s*=\s*\?1/.test(sql) || /am\.user_id\s*=\s*\?1/.test(sql);
    assert.ok(
      scoped,
      `A client query isn't scoped by user_id — a client could read another ` +
        `client's data by guessing an id:\n${sql.trim().slice(0, 200)}`,
    );
  }
});

/* -------------------------------------------------------------------------- */
/* The runtime guard                                                          */
/* -------------------------------------------------------------------------- */

test("assertClientSafe rejects internal tables at runtime", () => {
  assert.throws(
    () => assertClientSafe("SELECT * FROM tasks WHERE project_id = ?1"),
    /boundary violation/i,
  );
  assert.throws(
    () => assertClientSafe("SELECT * FROM checklist_item_events"),
    /checklist_item_events/,
  );
  assert.throws(
    () => assertClientSafe("SELECT * FROM revision_requests"),
    /revision_requests/,
  );
  assert.throws(
    () => assertClientSafe("SELECT * FROM activity_events"),
    /activity_events/,
  );
});

test("assertClientSafe allows legitimate client reads", () => {
  assert.doesNotThrow(() =>
    assertClientSafe(
      `SELECT p.id FROM projects p
         JOIN project_client_roles r ON r.project_id = p.id
        WHERE r.user_id = ?1`,
    ),
  );
});

test("a table name inside a string literal doesn't trigger a false positive", () => {
  assert.doesNotThrow(() =>
    assertClientSafe("SELECT id FROM projects WHERE health_note != 'ask about tasks'"),
  );
});

test("tablesReferenced finds tables across joins and aliases", () => {
  const found = tablesReferenced(
    `SELECT * FROM projects p JOIN client_accounts a ON a.id = p.account_id
       LEFT JOIN links l ON l.id = p.id`,
  );
  assert.deepEqual(found, ["client_accounts", "links", "projects"]);
});

test("client SQL never selects an internal-accountability column", () => {
  // checklists/checklist_items are client-readable at COLUMN level only. The
  // client sees which checks passed; who ticked them, the evidence and the
  // waiver reasons stay internal. Table-level classification can't express
  // that, so the columns are asserted directly.
  const source = fs.readFileSync(CLIENT_QUERIES, "utf8");
  const statements = [...source.matchAll(/`([^`]*SELECT[^`]*)`/gi)].map((m) => m[1]);

  for (const sql of statements) {
    for (const column of FORBIDDEN_CLIENT_COLUMNS) {
      assert.ok(
        !new RegExp(`\\b${column}\\b`).test(sql),
        `Client SQL selects "${column}", which is internal accountability, not ` +
          `a delivery standard:\n${sql.trim().slice(0, 180)}`,
      );
    }
  }
});

test("the client data path never imports internal queries", () => {
  // studio-queries.ts reaches everything by design. If a client-path module
  // ever imports it, the whole boundary is one autocomplete away from being
  // bypassed — so the import graph is asserted, not just the SQL.
  const clientPath = [
    "../data/index.ts",
    "../data/live.ts",
    "./client-queries.ts",
  ];
  for (const rel of clientPath) {
    const file = path.join(import.meta.dirname, rel);
    const source = fs.readFileSync(file, "utf8");
    assert.ok(
      !source.includes("studio-queries"),
      `${rel} imports studio-queries — internal data must not be reachable from a client request`,
    );
    assert.ok(
      !/from "\.\.\/studio\//.test(source),
      `${rel} imports from lib/studio — the two lenses must not share a read path`,
    );
  }
});

test("the internal list actually covers the things clients must never see", () => {
  // Named explicitly so deleting one from INTERNAL_ONLY fails loudly rather
  // than silently widening the boundary.
  // NOTE: `checklists` and `checklist_items` were on this list until the
  // studio decided clients should see which checks a deliverable passed. They
  // are now client-readable at COLUMN level, guarded by
  // FORBIDDEN_CLIENT_COLUMNS above. That was a deliberate product decision,
  // not a test relaxed to make a build pass — the event log, which carries the
  // attestations, is still absolutely internal.
  for (const table of [
    "tasks",
    "task_blockers",
    "checklist_item_events",
    "activity_events",
    "update_reads",
    "sessions",
    "auth_tokens",
    "project_team",
  ]) {
    assert.ok(isInternalOnly(table), `${table} must be internal-only`);
  }
});
