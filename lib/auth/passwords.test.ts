import assert from "node:assert/strict";
import test from "node:test";
import { burnTime, checkStrength, hashPassword, verifyPassword } from "./passwords.ts";

test("a password verifies against its own hash and nothing else", async () => {
  const stored = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", stored), true);
  assert.equal(await verifyPassword("Correct horse battery staple", stored), false);
  assert.equal(await verifyPassword("correct horse battery stapl", stored), false);
  assert.equal(await verifyPassword("", stored), false);
});

test("the same password hashes differently every time", async () => {
  const a = await hashPassword("correct horse battery staple");
  const b = await hashPassword("correct horse battery staple");
  assert.notEqual(a, b, "a shared salt would make the table rainbow-attackable");
  assert.equal(await verifyPassword("correct horse battery staple", b), true);
});

test("the stored form carries its own parameters", async () => {
  const stored = await hashPassword("correct horse battery staple");
  const [scheme, n, r, p] = stored.split("$");
  assert.equal(scheme, "scrypt");
  // Without these travelling alongside, raising the cost later would silently
  // lock out everyone whose hash was made with the old settings.
  assert.ok(Number(n) >= 2 ** 16, "work factor is recorded");
  assert.ok(Number(r) > 0 && Number(p) > 0);
  assert.equal(stored.split("$").length, 6);
});

test("a corrupt or foreign hash reads as a wrong password, never a crash", async () => {
  for (const junk of ["", "$$$$$", "bcrypt$2b$10$abcdef", "scrypt$x$y$z$!!$!!", "null"]) {
    assert.equal(await verifyPassword("anything", junk), false, junk);
  }
});

test("unicode passwords normalise, so the same keystrokes always work", async () => {
  // é as one code point vs e + combining accent. Different bytes, same password
  // as far as the person typing it is concerned.
  const stored = await hashPassword("café passphrasé");
  assert.equal(await verifyPassword("café passphrasé".normalize("NFD"), stored), true);
});

test("burnTime costs about what a real check costs", async () => {
  const stored = await hashPassword("correct horse battery staple");

  const t0 = performance.now();
  await verifyPassword("wrong wrong wrong wrong", stored);
  const real = performance.now() - t0;

  const t1 = performance.now();
  await burnTime("wrong wrong wrong wrong");
  const fake = performance.now() - t1;

  // If "no such account" returned instantly, the form would be a way to
  // enumerate who works here. Generous bound — CI machines are noisy.
  assert.ok(
    fake > real / 4,
    `unknown-account path (${fake.toFixed(0)}ms) must not be obviously faster than a real check (${real.toFixed(0)}ms)`,
  );
});

test("strength: length is the rule", () => {
  assert.equal(checkStrength("short", "ada@griida.com").ok, false);
  assert.equal(checkStrength("elevenchars", "ada@griida.com").ok, false);
  assert.equal(checkStrength("twelvechars!", "ada@griida.com").ok, true);
  // No composition rules — they push people to Password1! and a sticky note.
  assert.equal(checkStrength("all lower case letters", "ada@griida.com").ok, true);
});

test("strength: refuses the obvious ones", () => {
  const own = checkStrength("ada-is-the-best", "ada@griida.com");
  assert.equal(own.ok, false);
  assert.match(own.problem ?? "", /email/);

  assert.equal(checkStrength("passwordpassword", "ada@griida.com").ok, false);
  assert.equal(checkStrength("PasswordPassword", "ada@griida.com").ok, false, "case-insensitive");
});

test("strength: a very long passphrase is fine, an absurd one is not", () => {
  assert.equal(checkStrength("a".repeat(199), "ada@griida.com").ok, true);
  assert.equal(checkStrength("a".repeat(201), "ada@griida.com").ok, false);
});
