/**
 * Executable tests for the write layer.
 *
 * Every query in this codebase goes through one `fetch` in d1.ts, so stubbing
 * that single call against an in-memory SQLite database gives real tests of the
 * real SQL — the actual `?1` binding, the actual triggers, the actual foreign
 * keys — with no production code changed and no dependency injection.
 *
 * This exists because the write layer was previously "tested" by regex over its
 * own source. That style passes if the guard is present and wrong, and it
 * missed two confirmed data-corruption bugs. Assertions about behaviour belong
 * against behaviour.
 *
 * What it does NOT catch: D1's own limits (statement size, batch semantics,
 * network failure modes). SQLite-in-Node is not D1. It catches logic.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "../../..");

export interface Harness {
  db: DatabaseSync;
  /** Rows currently in a table — for asserting what a write actually did. */
  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[];
  one<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined;
  count(table: string, where?: string): number;
  /** Make the Nth matching query fail, to exercise error paths. */
  failNext(match: RegExp): void;
  restore(): void;
}

const realFetch = globalThis.fetch;

export function createHarness(options: { seed?: boolean } = {}): Harness {
  const db = new DatabaseSync(":memory:");
  // Every migration, in order — so the tests run against the schema production
  // actually has, and a migration that doesn't apply cleanly fails here first.
  for (const file of fs.readdirSync(path.join(ROOT, "db/migrations")).sort()) {
    if (file.endsWith(".sql")) {
      db.exec(fs.readFileSync(path.join(ROOT, "db/migrations", file), "utf8"));
    }
  }
  if (options.seed !== false) {
    db.exec(fs.readFileSync(path.join(ROOT, "db/seed/0001_demo.sql"), "utf8"));
    db.exec(fs.readFileSync(path.join(ROOT, "db/seed/0002_templates.sql"), "utf8"));
  }

  // d1.ts refuses to run without these; the values are never used, because
  // fetch is stubbed before any request is built.
  process.env.CLOUDFLARE_ACCOUNT_ID ||= "test";
  process.env.CLOUDFLARE_D1_DATABASE_ID ||= "test";
  process.env.CLOUDFLARE_API_TOKEN ||= "test";

  let failPattern: RegExp | null = null;

  globalThis.fetch = (async (_url: unknown, init: { body: string }) => {
    const { sql, params } = JSON.parse(init.body) as { sql: string; params: unknown[] };

    if (failPattern && failPattern.test(sql)) {
      failPattern = null;
      return { ok: false, status: 500, statusText: "Injected failure" };
    }

    try {
      const statement = db.prepare(sql);
      const isRead = /^\s*(select|with)/i.test(sql);
      if (isRead) {
        return {
          ok: true,
          json: async () => ({ success: true, result: [{ results: statement.all(...(params as never[])), success: true }] }),
        };
      }
      const info = statement.run(...(params as never[]));
      return {
        ok: true,
        json: async () => ({
          success: true,
          result: [{ results: [], success: true, meta: { changes: Number(info.changes) } }],
        }),
      };
    } catch (error) {
      return {
        ok: true,
        json: async () => ({
          success: false,
          errors: [{ code: 7500, message: (error as Error).message }],
        }),
      };
    }
  }) as unknown as typeof fetch;

  return {
    db,
    all: (sql, ...params) => db.prepare(sql).all(...(params as never[])) as never,
    one: (sql, ...params) => db.prepare(sql).all(...(params as never[]))[0] as never,
    count: (table, where) =>
      Number(
        (db.prepare(`SELECT count(*) AS n FROM ${table}${where ? ` WHERE ${where}` : ""}`).get() as { n: number }).n,
      ),
    failNext: (match) => {
      failPattern = match;
    },
    restore: () => {
      globalThis.fetch = realFetch;
      db.close();
    },
  };
}
