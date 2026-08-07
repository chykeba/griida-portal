/**
 * D1 access over Cloudflare's HTTP API.
 *
 * We host on Vercel, so there is no Workers binding available — every query is
 * a round trip to Cloudflare. That is a real cost (tens of milliseconds per
 * call, and it is a network hop that can fail), so:
 *   - fetch broadly, not chattily: one query per screen, not one per row;
 *   - never call this in a loop.
 *
 * If latency ever becomes the complaint, the fix is moving hosting to Workers
 * and using a binding, not adding a cache in front of per-user data.
 */
import { assertClientSafe } from "./tables.ts";

export interface D1Config {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

export function readConfig(): D1Config | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !apiToken) return null;
  return { accountId, databaseId, apiToken };
}

/** True when the app has credentials; false means fall back to demo data. */
export function isLive(): boolean {
  return readConfig() !== null;
}

interface D1Response<T> {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: { results: T[]; success: boolean; meta?: { changes?: number } }[];
}

interface Result<T> {
  rows: T[];
  /** Rows this statement changed. */
  changes: number;
}

async function execute<T>(sql: string, params: unknown[]): Promise<Result<T>> {
  const config = readConfig();
  if (!config) {
    throw new Error(
      "D1 is not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID " +
        "and CLOUDFLARE_API_TOKEN, or the app falls back to demo data.",
    );
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
      // Per-user data. Never cached at the edge — one client must never be
      // served another's project.
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`D1 request failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as D1Response<T>;
  if (!body.success) {
    const detail = body.errors?.map((e) => e.message).join("; ") ?? "unknown error";
    throw new Error(`D1 query failed: ${detail}`);
  }

  return {
    rows: body.result?.[0]?.results ?? [],
    changes: body.result?.[0]?.meta?.changes ?? 0,
  };
}

/**
 * Internal query. Reaches anything. Only ever called from studio-side code
 * after a permission check.
 */
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await execute<T>(sql, params)).rows;
}

/**
 * A write, returning how many rows it actually changed.
 *
 * Most writes here are conditional UPDATEs whose WHERE clause *is* the security
 * or state guard — `WHERE status = 'open'`, `WHERE checked_by != ?2`. Without
 * the count, "the guard rejected it" and "it worked" are indistinguishable,
 * which is how a double-submit came to tell a client "Got it" while dropping
 * their answer.
 *
 * The count travels with the call and is never stashed. It used to live in a
 * module-level variable read after the fact, which is a cross-request bug in a
 * process that serves concurrent requests: two people closing the same project
 * could each read the other's count, leaving the project closed with no audit
 * event and both of them told it had failed.
 */
export async function run(sql: string, params: unknown[] = []): Promise<number> {
  return (await execute(sql, params)).changes;
}

/**
 * Client query. Refuses to touch internal tables (§3b).
 *
 * This is the runtime half of the boundary — the static scan in
 * `boundary.test.ts` catches the SQL we can see at build time, and this catches
 * anything assembled dynamically. Both exist because on D1 there is no engine
 * doing it for us.
 */
export async function queryAsClient<T>(
  sql: string,
  params: unknown[] = [],
  context = "client query",
): Promise<T[]> {
  assertClientSafe(sql, context);
  return (await execute<T>(sql, params)).rows;
}

/** Booleans are stored 0/1 in SQLite. */
export function bool(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

/** JSON columns are stored as TEXT. */
export function json<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
