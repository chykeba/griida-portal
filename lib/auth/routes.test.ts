import assert from "node:assert/strict";
import test from "node:test";
import { isPublicPath, studioEquivalentOf } from "./routes.ts";

test("a studio user on a client URL lands on that project, studio side", () => {
  assert.equal(studioEquivalentOf("/p/hsf-website-redesign"), "/studio/p/hsf-website-redesign");
  assert.equal(studioEquivalentOf("/p/brand-identity"), "/studio/p/brand-identity");
});

test("deeper client routes fall back to the project, not a route that doesn’t exist", () => {
  // There is no /studio/p/<slug>/review/<id>. Mapping the whole path through
  // would swap one "we can’t find that page" for another.
  assert.equal(studioEquivalentOf("/p/brand-identity/review/dlv_1"), "/studio/p/brand-identity");
});

test("anything else goes to the studio front door", () => {
  assert.equal(studioEquivalentOf("/"), "/studio");
  assert.equal(studioEquivalentOf("/p/"), "/studio");
  assert.equal(studioEquivalentOf(""), "/studio");
});

test("the brand icons resolve without a session", () => {
  // Next serves app/icon.svg from a route, not /public, so the proxy sees it
  // like any other page. Redirecting it to /login answers a favicon request
  // with HTML and leaves the tab blank.
  assert.equal(isPublicPath("/icon.svg"), true);
  assert.equal(isPublicPath("/favicon.ico"), true);
  assert.equal(isPublicPath("/apple-icon.png"), true);
});

test("signing in and Next's own assets are public", () => {
  // The proxy sees pathname only — the query is not part of the match.
  for (const p of ["/login", "/auth/verify", "/_next/static/chunk.js"]) {
    assert.equal(isPublicPath(p), true, p);
  }
});

test("nothing else is", () => {
  for (const p of ["/", "/p/acme", "/studio", "/studio/team", "/iconography", "/logins"]) {
    assert.equal(isPublicPath(p), false, `${p} must still require a session`);
  }
});
