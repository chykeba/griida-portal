import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password hashing.
 *
 * scrypt from node:crypto — memory-hard, in the standard library, no native
 * module to build on Vercel. bcrypt and argon2 would both be defensible; they
 * would also both be a dependency, and neither buys anything a studio of five
 * would ever notice.
 *
 * Stored as `scrypt$N$r$p$salt$hash`, all base64. The parameters travel with
 * the hash so raising them later doesn't invalidate everyone's password — old
 * hashes keep verifying against the settings they were made with.
 */

/** ~64 MB, ~100ms on the machines this runs on. Tuned to be felt, not seen. */
const PARAMS = { N: 2 ** 16, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, PARAMS);
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Checks a password against a stored hash.
 *
 * Never throws on a malformed hash — a corrupt row must read as "wrong
 * password", not as a 500 that tells an attacker the row is special.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, n, r, p, salt, expected] = stored.split("$");
    if (scheme !== "scrypt") return false;

    const expectedBuf = Buffer.from(expected, "base64");
    const derived = await scrypt(
      password.normalize("NFKC"),
      Buffer.from(salt, "base64"),
      expectedBuf.length,
      { N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * 1024 * 1024 },
    );
    return timingSafeEqual(derived, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Burns the same time as a real verification, for addresses that don't exist
 * or have no password set.
 *
 * Without this, "no such user" returns in 2ms and "wrong password" in 100ms,
 * and the login form becomes a way to enumerate who works here — which for a
 * studio is a client list by inference. The wording is already identical; this
 * makes the timing identical too.
 */
export async function burnTime(password: string): Promise<void> {
  await scrypt(password.normalize("NFKC"), DUMMY_SALT, KEY_LENGTH, PARAMS).catch(() => {});
}

const DUMMY_SALT = randomBytes(16);

export interface Strength {
  ok: boolean;
  problem: string | null;
}

/**
 * The minimum that's worth enforcing.
 *
 * Length only, deliberately. Composition rules ("one number, one symbol")
 * measurably push people toward `Password1!` and a sticky note; length is the
 * thing that actually costs an attacker. NIST dropped composition rules in
 * 2017 and so do we.
 */
export function checkStrength(password: string, email: string): Strength {
  if (password.length < 12) {
    return { ok: false, problem: "Make it at least 12 characters — length is what makes it hard." };
  }
  if (password.length > 200) {
    return { ok: false, problem: "That’s longer than 200 characters." };
  }
  const local = email.split("@")[0]?.toLowerCase();
  if (local && local.length > 2 && password.toLowerCase().includes(local)) {
    return { ok: false, problem: "It contains your email address — that’s the first thing tried." };
  }
  if (COMMON.has(password.toLowerCase())) {
    return { ok: false, problem: "That’s one of the most-guessed passwords there is." };
  }
  return { ok: true, problem: null };
}

/**
 * Not a wordlist — a 12-character minimum already excludes almost everything
 * in one. These are the handful people reach for when told "12 characters".
 */
const COMMON = new Set([
  "password1234",
  "passwordpassword",
  "123456789012",
  "qwertyuiop12",
  "letmeinletmein",
  "administrator",
  "iloveyou1234",
  "welcome12345",
  "abcdefghijkl",
  "111111111111",
  "qwertyqwerty",
]);
