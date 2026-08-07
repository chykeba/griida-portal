import { query, run } from "../db/d1.ts";
import { LOCKOUT_AFTER, isExpired, isoNow, lockoutExpiry, normaliseEmail } from "./tokens.ts";
import { burnTime, checkStrength, hashPassword, verifyPassword } from "./passwords.ts";

/**
 * Password checking, without the request.
 *
 * Split out from session.ts purely so it can be tested: session.ts imports
 * `next/headers` for the cookie jar, which cannot be loaded outside Next. The
 * lockout rules and the refusal to distinguish failures are the security-
 * relevant part of passwords, and they were untestable while they lived there.
 */

export interface CredentialUser {
  id: string;
  email: string;
  kind: "studio" | "client";
  studio_role: "super_admin" | "admin_pm" | "lead" | "member" | null;
  full_name: string;
  first_name: string | null;
  is_active: number;
}

export type CredentialResult =
  | { ok: true; user: CredentialUser }
  | { ok: false; reason: "no" | "locked" };

/**
 * Verifies an email and password.
 *
 * Two things this deliberately does NOT do:
 *
 *  - **Distinguish its failures.** Unknown address, no password set, wrong
 *    password and a client account all return `no`. Anything finer turns the
 *    form into a way to enumerate who works here, and for a studio that is a
 *    client list by inference. The timing is levelled too — see burnTime.
 *  - **Fall back to a link.** If the password is wrong the caller offers the
 *    link; silently emailing one on a failed attempt would let a stranger
 *    trigger mail to any address they can guess.
 */
export async function checkCredentials(
  rawEmail: string,
  password: string,
): Promise<CredentialResult> {
  const email = normaliseEmail(rawEmail);

  const users = await query<CredentialUser & { password_hash: string | null; locked_until: string | null }>(
    `SELECT id, email, kind, studio_role, full_name, first_name, is_active,
            password_hash, locked_until
       FROM users WHERE email = ?1 LIMIT 1`,
    [email],
  );
  const user = users[0];

  // Clients have no password by design, and an inactive account has none that
  // counts. Both burn the same time as a real check.
  if (!user || user.is_active !== 1 || user.kind !== "studio" || !user.password_hash) {
    await burnTime(password);
    return { ok: false, reason: "no" };
  }

  if (user.locked_until && !isExpired(user.locked_until)) {
    await burnTime(password);
    return { ok: false, reason: "locked" };
  }

  if (!(await verifyPassword(password, user.password_hash))) {
    // Count it, and lock the account once the count says this is guessing
    // rather than fumbling.
    // One statement, so two parallel attempts can't both read 7 and both
    // write 8. The timestamp comes from JS to match every other expiry here —
    // see lockoutExpiry for why SQLite's datetime() is wrong for this.
    await run(
      `UPDATE users
          SET failed_signins = failed_signins + 1,
              locked_until = CASE WHEN failed_signins + 1 >= ?2
                                  THEN ?3 ELSE locked_until END
        WHERE id = ?1`,
      [user.id, LOCKOUT_AFTER, lockoutExpiry()],
    );
    return { ok: false, reason: "no" };
  }

  await run(`UPDATE users SET failed_signins = 0, locked_until = NULL WHERE id = ?1`, [user.id]);
  return { ok: true, user };
}

/**
 * Checks a password without signing anyone in.
 *
 * signInWithPassword starts a session as its whole point, which is wrong for
 * "confirm it's really you before changing it" — that would leave a second
 * live session behind every password change.
 */
export async function verifyCurrentPassword(
  userId: string,
  password: string,
): Promise<boolean> {
  const rows = await query<{ password_hash: string | null }>(
    `SELECT password_hash FROM users WHERE id = ?1 AND is_active = 1 LIMIT 1`,
    [userId],
  );
  const hashValue = rows[0]?.password_hash;
  if (!hashValue) {
    await burnTime(password);
    return false;
  }
  return verifyPassword(password, hashValue);
}

/**
 * Sets or replaces a password. Studio only — the trigger in migration 0003
 * refuses anything else even if this is bypassed.
 *
 * Setting one clears any lockout: proving you can already sign in is strictly
 * stronger evidence than waiting fifteen minutes.
 */
export async function setPassword(userId: string, password: string): Promise<void> {
  const users = await query<{ kind: string; email: string }>(
    `SELECT kind, email FROM users WHERE id = ?1 LIMIT 1`,
    [userId],
  );
  const user = users[0];
  if (!user) throw new Error("That account has gone.");
  if (user.kind !== "studio") {
    throw new Error("Client accounts sign in with a link — there’s no password to set.");
  }

  const strength = checkStrength(password, user.email);
  if (!strength.ok) throw new Error(strength.problem!);

  await run(
    `UPDATE users SET password_hash = ?2, password_set_at = ?3,
            failed_signins = 0, locked_until = NULL
      WHERE id = ?1`,
    [userId, await hashPassword(password), isoNow()],
  );
}

/** Back to link-only. */
export async function removePassword(userId: string): Promise<void> {
  await run(
    `UPDATE users SET password_hash = NULL, password_set_at = NULL WHERE id = ?1`,
    [userId],
  );
}

export async function hasPassword(userId: string): Promise<boolean> {
  const rows = await query<{ n: number }>(
    `SELECT count(*) AS n FROM users WHERE id = ?1 AND password_hash IS NOT NULL`,
    [userId],
  );
  return (rows[0]?.n ?? 0) > 0;
}
