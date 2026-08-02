import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { mayCountersign, mayTick, type ItemContext } from "./checklist-writes.ts";

function ctx(over: Partial<ItemContext> = {}): ItemContext {
  return {
    itemId: "i1",
    checklistId: "cl1",
    deliverableId: "d1",
    projectId: "p1",
    label: "Contrast checked",
    state: "checked",
    requiresCountersign: true,
    evidenceKind: "none",
    checkedBy: "u_femi",
    ownerId: "u_femi",
    ...over,
  };
}

/* -------------------------------------------------------------------------- */
/* The rule the whole mechanism rests on                                       */
/* -------------------------------------------------------------------------- */

test("you cannot countersign your own attestation", () => {
  // Femi checked it. Femi is a member, but even as a lead he could not sign it.
  const asFemiTheLead = mayCountersign(ctx({ checkedBy: "u_femi" }), "u_femi", "lead");
  assert.equal(asFemiTheLead.ok, false);
  assert.match(
    (asFemiTheLead as { why: string }).why,
    /someone else has to countersign/,
    "the refusal has to explain why, or it reads as a bug",
  );

  // A different lead can.
  assert.equal(mayCountersign(ctx({ checkedBy: "u_femi" }), "u_ada", "lead").ok, true);
});

test("even a super admin cannot countersign their own tick", () => {
  // Seniority is not the point — a second pair of eyes is.
  assert.equal(mayCountersign(ctx({ checkedBy: "u_chike" }), "u_chike", "super_admin").ok, false);
});

test("countersigning needs seniority as well as separation", () => {
  const asMember = mayCountersign(ctx({ checkedBy: "u_femi" }), "u_other", "member");
  assert.equal(asMember.ok, false);
  assert.match((asMember as { why: string }).why, /leads and above/);
});

test("there is nothing to countersign until it is checked", () => {
  assert.equal(mayCountersign(ctx({ state: "open" }), "u_ada", "lead").ok, false);
  assert.equal(mayCountersign(ctx({ state: "waived" }), "u_ada", "lead").ok, false);
  // Already countersigned — not re-signable.
  assert.equal(mayCountersign(ctx({ state: "countersigned" }), "u_ada", "lead").ok, false);
});

test("an item that doesn't require a countersign refuses one", () => {
  const v = mayCountersign(ctx({ requiresCountersign: false }), "u_ada", "lead");
  assert.equal(v.ok, false);
  assert.match((v as { why: string }).why, /doesn’t need a second pair/);
});

/* -------------------------------------------------------------------------- */

test("the deliverable's owner ticks their own items; strangers don't", () => {
  const item = ctx({ ownerId: "u_femi" });
  assert.equal(mayTick(item, "u_femi", "member"), true);
  assert.equal(mayTick(item, "u_stranger", "member"), false);
  // Seniors can step in — someone has to be able to unstick a project.
  assert.equal(mayTick(item, "u_ada", "lead"), true);
  assert.equal(mayTick(item, "u_pat", "admin_pm"), true);
});

/* -------------------------------------------------------------------------- */
/* Append-only, asserted in the SQL                                            */
/* -------------------------------------------------------------------------- */

const SOURCE = fs.readFileSync(
  path.join(import.meta.dirname, "checklist-writes.ts"),
  "utf8",
);

test("every state change appends an event — nothing mutates the log", () => {
  // The projection may be UPDATEd; the log may only ever be INSERTed into.
  assert.ok(
    !/UPDATE checklist_item_events/.test(SOURCE),
    "the event log must never be updated",
  );
  assert.ok(
    !/DELETE FROM checklist_item_events/.test(SOURCE),
    "the event log must never be deleted from",
  );
  assert.match(SOURCE, /INSERT INTO checklist_item_events/);

  // Each of the four transitions writes one.
  for (const kind of ["checked", "unchecked", "countersigned", "waived"]) {
    assert.ok(
      new RegExp(`"${kind}"`).test(SOURCE),
      `no event appended for "${kind}"`,
    );
  }
});

test("the countersign UPDATE re-checks separation in SQL, not just in the guard", () => {
  // Belt and braces: even if mayCountersign were bypassed, the row won't move.
  const sql = SOURCE.match(/`(UPDATE checklist_items\s+SET state = 'countersigned'[^`]*)`/)?.[1] ?? "";
  assert.match(sql, /checked_by != \?2/, "the UPDATE doesn't exclude the original checker");
});

test("unticking and waiving both demand a reason", () => {
  assert.match(SOURCE, /Say why you’re unticking it/);
  assert.match(SOURCE, /A waiver needs a reason/);
});

test("evidence requirements are enforced at write time", () => {
  assert.match(SOURCE, /needs a link to where the work is/);
  assert.match(SOURCE, /needs a note saying what you found/);
});
