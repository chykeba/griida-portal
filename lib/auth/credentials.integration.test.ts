/**
 * Password sign-in against a real database.
 *
 * Passwords are the one thing in this product that can be guessed at leisure,
 * so the lockout and the refusal to distinguish failures are the feature. They
 * are tested here rather than by reading the code.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createHarness, type Harness } from "../db/testing/harness.ts";

let h: Harness;

test.beforeEach(() => {
  h = createHarness();
});
test.afterEach(() => {
  h.restore();
});

const GOOD = "a genuinely long passphrase";

async function giveChikeAPassword() {
  const { setPassword } = await import("./credentials.ts");
  await setPassword("u_chike", GOOD);
}

test("the right password signs a studio user in", async () => {
  const { checkCredentials } = await import("./credentials.ts");
  await giveChikeAPassword();

  const result = await checkCredentials("hellogriida@gmail.com", GOOD);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.user.id, "u_chike");
});

test("the address is matched however it was typed", async () => {
  const { checkCredentials } = await import("./credentials.ts");
  await giveChikeAPassword();

  const result = await checkCredentials("  HelloGriida@Gmail.com  ", GOOD);
  assert.equal(result.ok, true, "case and stray spaces are the user's, not a failure");
});

test("every failure looks the same from outside", async () => {
  const { checkCredentials } = await import("./credentials.ts");
  await giveChikeAPassword();

  const wrong = await checkCredentials("hellogriida@gmail.com", "not the password");
  const missing = await checkCredentials("nobody@nowhere.com", GOOD);
  const noPasswordSet = await checkCredentials("ada@griida.com", GOOD);
  const client = await checkCredentials("tunde@ovishealth.com", GOOD);

  // Wrong password, no such account, no password set, and a client account are
  // four different situations. Saying which is how a login form becomes a way
  // to enumerate a studio's staff and client list.
  for (const [name, r] of Object.entries({ wrong, missing, noPasswordSet, client })) {
    assert.equal(r.ok, false, name);
    assert.equal(r.ok === false && r.reason, "no", name);
  }
});

test("a client cannot be given a password at all", async () => {
  const { setPassword } = await import("./credentials.ts");
  await assert.rejects(
    () => setPassword("u_tunde", GOOD),
    /sign in with a link/,
    "clients are link-only by design, not by omission",
  );
  assert.equal(
    h.one<{ password_hash: string | null }>(
      "SELECT password_hash FROM users WHERE id='u_tunde'",
    )?.password_hash,
    null,
  );
});

test("the database refuses a client password even if the code is bypassed", async () => {
  const { hashPassword } = await import("./passwords.ts");
  const hash = await hashPassword(GOOD);
  // Straight past setPassword, the way a future query might.
  assert.throws(
    () => h.db.exec(`UPDATE users SET password_hash = '${hash}' WHERE id = 'u_tunde'`),
    /studio users only/,
  );
});

test("guessing locks the account, and the lock survives a correct password", async () => {
  const { checkCredentials } = await import("./credentials.ts");
  await giveChikeAPassword();

  for (let i = 0; i < 8; i++) {
    const r = await checkCredentials("hellogriida@gmail.com", `guess ${i}`);
    assert.equal(r.ok, false);
  }

  const locked = await checkCredentials("hellogriida@gmail.com", GOOD);
  assert.equal(locked.ok, false, "the correct password must not open a locked account");
  assert.equal(locked.ok === false && locked.reason, "locked");

  assert.ok(
    h.one<{ locked_until: string }>("SELECT locked_until FROM users WHERE id='u_chike'")
      ?.locked_until,
    "the lock is recorded, not inferred",
  );
});

test("a lock expires on its own", async () => {
  const { checkCredentials } = await import("./credentials.ts");
  await giveChikeAPassword();
  for (let i = 0; i < 8; i++) await checkCredentials("hellogriida@gmail.com", "no");

  h.db.exec(`UPDATE users SET locked_until = datetime('now','-1 minute') WHERE id='u_chike'`);
  const after = await checkCredentials("hellogriida@gmail.com", GOOD);
  assert.equal(after.ok, true, "fifteen minutes later you get back in without support");
});

test("one good sign-in clears the count, so fumbling never accumulates", async () => {
  const { checkCredentials } = await import("./credentials.ts");
  await giveChikeAPassword();

  for (let i = 0; i < 7; i++) await checkCredentials("hellogriida@gmail.com", "typo");
  assert.equal(
    h.one<{ failed_signins: number }>("SELECT failed_signins FROM users WHERE id='u_chike'")
      ?.failed_signins,
    7,
  );

  assert.equal((await checkCredentials("hellogriida@gmail.com", GOOD)).ok, true);
  assert.equal(
    h.one<{ failed_signins: number }>("SELECT failed_signins FROM users WHERE id='u_chike'")
      ?.failed_signins,
    0,
    "a week of occasional typos must not add up to a lockout",
  );
});

test("setting a password clears a lockout", async () => {
  const { checkCredentials, setPassword } = await import("./credentials.ts");
  await giveChikeAPassword();
  for (let i = 0; i < 8; i++) await checkCredentials("hellogriida@gmail.com", "no");

  // Getting in by magic link and setting a new one is stronger evidence than
  // waiting out the clock, so it shouldn't be punished by it.
  await setPassword("u_chike", "a different long passphrase");
  const result = await checkCredentials("hellogriida@gmail.com", "a different long passphrase");
  assert.equal(result.ok, true);
});

test("a weak password is refused at the point of setting it", async () => {
  const { setPassword } = await import("./credentials.ts");
  await assert.rejects(() => setPassword("u_chike", "short"), /12 characters/);
  assert.equal(
    h.one<{ password_hash: string | null }>(
      "SELECT password_hash FROM users WHERE id='u_chike'",
    )?.password_hash,
    null,
    "a rejected password must not be half-written",
  );
});

test("an inactive account can't sign in with a password it still has", async () => {
  const { checkCredentials } = await import("./credentials.ts");
  await giveChikeAPassword();
  h.db.exec(`UPDATE users SET is_active = 0 WHERE id='u_chike'`);

  const result = await checkCredentials("hellogriida@gmail.com", GOOD);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "no");
});

test("removing a password puts you back on links only", async () => {
  const { checkCredentials, hasPassword, removePassword } = await import("./credentials.ts");
  await giveChikeAPassword();
  assert.equal(await hasPassword("u_chike"), true);

  await removePassword("u_chike");
  assert.equal(await hasPassword("u_chike"), false);
  assert.equal((await checkCredentials("hellogriida@gmail.com", GOOD)).ok, false);
});

test("verifying the current password does not mint a session", async () => {
  const { verifyCurrentPassword } = await import("./credentials.ts");
  await giveChikeAPassword();
  const before = h.count("sessions");

  assert.equal(await verifyCurrentPassword("u_chike", GOOD), true);
  assert.equal(await verifyCurrentPassword("u_chike", "wrong"), false);
  assert.equal(h.count("sessions"), before, "a password change must not leave a session behind");
});
