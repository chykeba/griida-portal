import assert from "node:assert/strict";
import test from "node:test";
import {
  hash,
  isExpired,
  landingFor,
  looksLikeEmail,
  normaliseEmail,
  randomToken,
  safeNext,
} from "./tokens.ts";

test("tokens are long, unique and URL-safe", async () => {
  const a = randomToken();
  const b = randomToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 40, `token too short: ${a.length}`);
  assert.match(a, /^[A-Za-z0-9_-]+$/, "must survive a URL without encoding");
  // 500 draws, no collisions — a sanity check on the entropy source.
  const seen = new Set(Array.from({ length: 500 }, () => randomToken()));
  assert.equal(seen.size, 500);
});

test("hashing is stable and one-way-ish", async () => {
  const token = "some-token";
  assert.equal(await hash(token), await hash(token));
  assert.notEqual(await hash(token), await hash("some-token "));
  assert.equal((await hash(token)).length, 64); // sha-256 hex
  assert.notEqual(await hash(token), token);
});

test("expiry fails closed", () => {
  const past = new Date(Date.now() - 1000).toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(isExpired(past), true);
  assert.equal(isExpired(future), false);
  // Anything we can't read is treated as expired, never as valid.
  assert.equal(isExpired(null), true);
  assert.equal(isExpired(undefined), true);
  assert.equal(isExpired(""), true);
  assert.equal(isExpired("not a date"), true);
});

/* -------------------------------------------------------------------------- */
/* Open redirect — the hole a magic link most easily opens                     */
/* -------------------------------------------------------------------------- */

test("safeNext rejects anything that could leave the site", () => {
  // The obvious ones
  assert.equal(safeNext("https://evil.com"), "/");
  assert.equal(safeNext("http://evil.com"), "/");
  // Protocol-relative — browsers treat this as absolute
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("//evil.com/path"), "/");
  // Backslash variant, which some browsers normalise to //
  assert.equal(safeNext("/\\evil.com"), "/");
  // Scheme tricks
  assert.equal(safeNext("javascript:alert(1)"), "/");
  assert.equal(safeNext("data:text/html,x"), "/");
  // Header/URL splitting
  assert.equal(safeNext("/p/x\nLocation: https://evil.com"), "/");
  assert.equal(safeNext("/p/x\r\nSet-Cookie: a=b"), "/");
  // Missing or empty
  assert.equal(safeNext(null), "/");
  assert.equal(safeNext(""), "/");
  assert.equal(safeNext(undefined, "/studio"), "/studio");
});

test("safeNext keeps legitimate deep links", () => {
  assert.equal(safeNext("/p/website"), "/p/website");
  assert.equal(safeNext("/p/website?view=sheet"), "/p/website?view=sheet");
  assert.equal(safeNext("/p/brand-identity/review/dlv_concepts"), "/p/brand-identity/review/dlv_concepts");
  assert.equal(safeNext("/studio/standup?at=1"), "/studio/standup?at=1");
});

test("a client can never be landed in the studio lens", () => {
  // Even if the link says so — this is the publish boundary at the door.
  assert.equal(landingFor("client", "/studio"), "/");
  assert.equal(landingFor("client", "/studio/my-work"), "/");
  assert.equal(landingFor("client", "/p/website"), "/p/website");
  assert.equal(landingFor("client", null), "/");
});

test("studio users land in the studio by default", () => {
  assert.equal(landingFor("studio", null), "/studio");
  assert.equal(landingFor("studio", "/studio/standup"), "/studio/standup");
  // A studio user may legitimately want the client view of a project.
  assert.equal(landingFor("studio", "/p/website"), "/p/website");
  assert.equal(landingFor("studio", "https://evil.com"), "/studio");
});

test("email normalisation and validation", () => {
  assert.equal(normaliseEmail("  HelloGriida@Gmail.com "), "hellogriida@gmail.com");
  assert.ok(looksLikeEmail("hellogriida@gmail.com"));
  assert.ok(!looksLikeEmail("not-an-email"));
  assert.ok(!looksLikeEmail("a@b"));
  assert.ok(!looksLikeEmail(""));
});
