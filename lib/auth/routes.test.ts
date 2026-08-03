import assert from "node:assert/strict";
import test from "node:test";
import { studioEquivalentOf } from "./routes.ts";

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
