import "server-only";

import { cookies } from "next/headers";
import { query } from "../db/d1.ts";
import {
  MAX_LINKS_PER_WINDOW,
  RATE_WINDOW_MINUTES,
  SESSION_COOKIE,
  hash,
  isExpired,
  isoNow,
  magicLinkExpiry,
  normaliseEmail,
  randomToken,
  sessionExpiry,
} from "./tokens.ts";
import { checkCredentials } from "./credentials.ts";

export interface SessionUser {
  id: string;
  email: string;
  kind: "studio" | "client";
  studioRole: "super_admin" | "admin_pm" | "lead" | "member" | null;
  fullName: string;
  firstName: string | null;
}

interface UserRow {
  id: string;
  email: string;
  kind: "studio" | "client";
  studio_role: SessionUser["studioRole"];
  full_name: string;
  first_name: string | null;
  is_active: number;
}

/* -------------------------------------------------------------------------- */
/* Issuing a magic link                                                        */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Signing in with a password (studio only)                                    */
/* -------------------------------------------------------------------------- */

export type PasswordResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "no" | "locked" };

/**
 * Verifies an email and password and starts a session.
 *
 * The checking lives in credentials.ts, which has no dependency on cookies and
 * so can be tested against a real database. This is only the half that needs
 * the request.
 */
export async function signInWithPassword(
  rawEmail: string,
  password: string,
): Promise<PasswordResult> {
  const result = await checkCredentials(rawEmail, password);
  if (!result.ok) return result;
  await startSession(result.user.id);
  return { ok: true, user: toSessionUser(result.user) };
}

export { hasPassword, removePassword, setPassword, verifyCurrentPassword } from "./credentials.ts";

/* -------------------------------------------------------------------------- */

export interface IssueResult {
  /** The raw token — emailed, never stored. Null when no link was issued. */
  token: string | null;
  /** Present in development so the flow is usable without an email provider. */
  devUrl?: string;
}

/**
 * Issues a magic link, or quietly does nothing.
 *
 * Deliberately returns the same shape whether or not the address belongs to a
 * real user: the caller shows "check your email" either way. Telling a stranger
 * which addresses exist is a free gift to anyone probing the studio's client
 * list, and that list is itself commercially sensitive.
 */
export async function issueMagicLink(rawEmail: string, origin: string): Promise<IssueResult> {
  const email = normaliseEmail(rawEmail);

  const users = await query<UserRow>(
    `SELECT id, email, kind, studio_role, full_name, first_name, is_active
       FROM users WHERE email = ?1 LIMIT 1`,
    [email],
  );
  const user = users[0];
  if (!user || user.is_active !== 1) return { token: null };

  // Blunt the "mail-bomb someone's inbox" nuisance. Not a defence against a
  // determined attacker, just enough that the button isn't a weapon.
  const recent = await query<{ n: number }>(
    `SELECT count(*) AS n FROM auth_tokens
      WHERE user_id = ?1 AND used_at IS NULL AND purpose = 'login'
        AND created_at > datetime('now', ?2)`,
    [user.id, `-${RATE_WINDOW_MINUTES} minutes`],
  );
  if ((recent[0]?.n ?? 0) >= MAX_LINKS_PER_WINDOW) return { token: null };

  const token = randomToken();
  await query(
    `INSERT INTO auth_tokens (token, user_id, expires_at, purpose) VALUES (?1, ?2, ?3, 'login')`,
    // Only the hash is stored. A database leak yields nothing presentable.
    [await hash(token), user.id, magicLinkExpiry()],
  );

  const url = `${origin}/auth/verify?token=${token}`;
  return { token, devUrl: process.env.NODE_ENV === "production" ? undefined : url };
}

/* -------------------------------------------------------------------------- */
/* Consuming it                                                                */
/* -------------------------------------------------------------------------- */

export type ConsumeResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/** Verifies a magic link, burns it, and starts a session. */
export async function consumeMagicLink(rawToken: string): Promise<ConsumeResult> {
  const tokenHash = await hash(rawToken);

  const rows = await query<{
    token: string;
    user_id: string;
    expires_at: string;
    used_at: string | null;
  }>(
    `SELECT token, user_id, expires_at, used_at FROM auth_tokens WHERE token = ?1 LIMIT 1`,
    [tokenHash],
  );

  const record = rows[0];
  if (!record) return { ok: false, reason: "invalid" };
  if (record.used_at) return { ok: false, reason: "used" };
  if (isExpired(record.expires_at)) return { ok: false, reason: "expired" };

  // Burn it before issuing the session, so a double-click can't mint two.
  await query(`UPDATE auth_tokens SET used_at = ?1 WHERE token = ?2`, [isoNow(), tokenHash]);

  const users = await query<UserRow>(
    `SELECT id, email, kind, studio_role, full_name, first_name, is_active
       FROM users WHERE id = ?1 LIMIT 1`,
    [record.user_id],
  );
  const user = users[0];
  if (!user || user.is_active !== 1) return { ok: false, reason: "invalid" };

  await startSession(user.id);
  return { ok: true, user: toSessionUser(user) };
}

async function startSession(userId: string): Promise<void> {
  const sessionId = randomToken();
  await query(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?1, ?2, ?3)`, [
    await hash(sessionId),
    userId,
    sessionExpiry(),
  ]);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true, // never readable by script
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // survives the click from an email, blocks cross-site POSTs
    path: "/",
    maxAge: 30 * 86_400,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (raw) {
    // Delete server-side too — clearing the cookie alone would leave a valid
    // session for anyone who copied it.
    await query(`DELETE FROM sessions WHERE id = ?1`, [await hash(raw)]).catch(() => {});
  }
  jar.delete(SESSION_COOKIE);
}

/* -------------------------------------------------------------------------- */
/* Reading the session                                                         */
/* -------------------------------------------------------------------------- */

/** Resolves the signed-in user, or null. Every call hits D1 — see dal.ts. */
export async function readSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const rows = await query<UserRow & { expires_at: string }>(
    `SELECT u.id, u.email, u.kind, u.studio_role, u.full_name, u.first_name, u.is_active,
            s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ?1
      LIMIT 1`,
    [await hash(raw)],
  );

  const row = rows[0];
  if (!row || row.is_active !== 1 || isExpired(row.expires_at)) return null;
  return toSessionUser(row);
}

function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    kind: row.kind,
    studioRole: row.studio_role,
    fullName: row.full_name,
    firstName: row.first_name,
  };
}
