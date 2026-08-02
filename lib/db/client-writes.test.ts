import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { nextRoundIsBillable, type ReviewContext } from "./client-writes.ts";

function ctx(over: Partial<ReviewContext> = {}): ReviewContext {
  return {
    deliverableId: "d1",
    projectId: "p1",
    name: "Page designs",
    currentRound: 1,
    roundsIncluded: 2,
    versionId: "v1",
    ...over,
  };
}

test("the billable line is drawn at the round the request would create", () => {
  // Round 1 of 2 -> next is round 2, still included.
  assert.equal(nextRoundIsBillable(ctx({ currentRound: 1, roundsIncluded: 2 })), false);
  // Round 2 of 2 -> next is round 3, beyond scope. This is the case the studio
  // asked to be surfaced rather than blocked.
  assert.equal(nextRoundIsBillable(ctx({ currentRound: 2, roundsIncluded: 2 })), true);
  // Already past it stays past it.
  assert.equal(nextRoundIsBillable(ctx({ currentRound: 3, roundsIncluded: 2 })), true);
});

test("a single-round agreement is billable straight after the first pass", () => {
  assert.equal(nextRoundIsBillable(ctx({ currentRound: 1, roundsIncluded: 1 })), true);
});

test("a generous agreement stays included", () => {
  assert.equal(nextRoundIsBillable(ctx({ currentRound: 3, roundsIncluded: 5 })), false);
});

/* -------------------------------------------------------------------------- */

const SOURCE = fs.readFileSync(
  path.join(import.meta.dirname, "client-writes.ts"),
  "utf8",
);

test("every client write re-checks ownership in SQL, not just in the caller", () => {
  // A client posting someone else's deliverable id must change zero rows. That
  // is only true if the UPDATE itself is constrained — checking in the action
  // and trusting it here would be one refactor away from a hole.
  const updates = [...SOURCE.matchAll(/`(UPDATE deliverables[^`]*)`/g)].map((m) => m[1]);
  assert.ok(updates.length > 0, "expected deliverable updates to check");

  for (const sql of updates) {
    assert.match(
      sql,
      /project_client_roles WHERE user_id = \?3/,
      `An UPDATE doesn't constrain by the caller's role:\n${sql}`,
    );
    assert.match(
      sql,
      /status = 'in_review'/,
      `An UPDATE doesn't constrain the starting state — a client could approve ` +
        `something twice, or approve work already delivered:\n${sql}`,
    );
  }
});

test("the reviewable lookup is scoped by role and state", () => {
  const select = SOURCE.match(/`(SELECT d\.id[^`]*)`/)?.[1] ?? "";
  assert.match(select, /JOIN project_client_roles r ON r\.project_id = d\.project_id/);
  assert.match(select, /r\.user_id = \?1/);
  assert.match(select, /d\.status = 'in_review'/);
});

test("a decision never overwrites one already made", () => {
  // The pending row is selected by decision='pending', so a settled review is
  // never re-decided. If none exists the decision is inserted instead — a
  // client's answer must not depend on the studio having created the row.
  assert.match(SOURCE, /WHERE version_id = \?1 AND decision = 'pending'/);
  assert.match(SOURCE, /INSERT INTO reviews/);
  const updates = [...SOURCE.matchAll(/`(UPDATE reviews[^`]*)`/g)].map((m) => m[1]);
  for (const sql of updates) {
    assert.match(sql, /WHERE id = \?5/, `an unscoped reviews UPDATE:\n${sql}`);
  }
});

test("an over-scope request is recorded rather than blocked", () => {
  // The studio's decision: don't stop the client, price it and tell them.
  assert.match(SOURCE, /INSERT INTO revision_requests/);
  assert.match(SOURCE, /'proposed'/);
  assert.ok(
    !/throw new Error\(["'`].*billable/i.test(SOURCE),
    "requesting a billable round must not throw — it is allowed, and priced",
  );
});
