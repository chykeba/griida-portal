import assert from "node:assert/strict";
import test from "node:test";
import {
  canCountersign,
  canPublish,
  canTick,
  checklistProgress,
  composeDraft,
  isSettled,
  blockingOthers,
  myWork,
} from "./logic.ts";
import { demoStudio } from "./demo.ts";
import type { ChecklistItem, Person, StudioDeliverable } from "./types.ts";

const lead: Person = { id: "p_ada", name: "Ada", initials: "AO", role: "lead" };
const member: Person = { id: "p_femi", name: "Femi", initials: "FB", role: "member" };
const other: Person = { id: "p_zed", name: "Zed", initials: "ZZ", role: "member" };

function item(over: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: "i", position: 1, label: "x", guidance: null, isRequired: true,
    evidenceKind: "none", expectedSource: null, requiresCountersign: false,
    isFinalDeliverable: false, state: "open", checkedById: null, checkedAt: null,
    countersignedById: null, evidenceUrl: null, evidenceText: null, waivedReason: null,
    ...over,
  };
}

function deliverable(over: Partial<StudioDeliverable> = {}): StudioDeliverable {
  return {
    id: "d", name: "D", typeName: "T", status: "draft", ownerId: "p_femi",
    round: 1, roundsIncluded: 2, stateChangedAt: "", reviewUrl: null,
    linkAccessOk: null, checklist: null, ...over,
  };
}

test("a checked item still blocks when it needs a countersign", () => {
  assert.equal(isSettled(item({ state: "checked" })), true);
  assert.equal(isSettled(item({ state: "checked", requiresCountersign: true })), false);
  assert.equal(isSettled(item({ state: "countersigned", requiresCountersign: true })), true);
  assert.equal(isSettled(item({ state: "waived" })), true);
  assert.equal(isSettled(item({ state: "open" })), false);
});

test("progress counts only required items", () => {
  const p = checklistProgress({
    deliverableId: "d", templateName: "t", templateVersion: 1,
    items: [
      item({ id: "a", state: "checked" }),
      item({ id: "b", state: "open" }),
      item({ id: "c", state: "open", isRequired: false }),
    ],
  });
  assert.equal(p.total, 2);
  assert.equal(p.done, 1);
  assert.equal(p.outstanding.length, 1);
});

test("an unverified client link hard-blocks and cannot be waived away", () => {
  const g = canPublish(deliverable({ reviewUrl: "https://x", linkAccessOk: null }));
  assert.equal(g.ok, false);
  assert.equal(g.hardBlocked, true);
  assert.match(g.reasons[0], /viewable by this client/);

  // Even with every checklist item waived, the link still blocks.
  const g2 = canPublish(
    deliverable({
      reviewUrl: "https://x",
      linkAccessOk: false,
      checklist: {
        deliverableId: "d", templateName: "Icon set", templateVersion: 1,
        items: [item({ state: "waived" })],
      },
    }),
  );
  assert.equal(g2.hardBlocked, true);
});

test("outstanding checklist items block, but softly", () => {
  const g = canPublish(
    deliverable({
      reviewUrl: "https://x",
      linkAccessOk: true,
      checklist: {
        deliverableId: "d", templateName: "Icon set", templateVersion: 1,
        items: [item({ state: "open" }), item({ id: "j", state: "checked" })],
      },
    }),
  );
  assert.equal(g.ok, false);
  assert.equal(g.hardBlocked, false); // waivable
  assert.match(g.reasons[0], /1 required item outstanding/);
});

test("a fully settled deliverable with a verified link passes", () => {
  const g = canPublish(
    deliverable({
      reviewUrl: "https://x",
      linkAccessOk: true,
      checklist: {
        deliverableId: "d", templateName: "Icon set", templateVersion: 1,
        items: [item({ state: "checked" }), item({ id: "k", state: "waived" })],
      },
    }),
  );
  assert.equal(g.ok, true);
  assert.deepEqual(g.reasons, []);
});

test("only the deliverable's owner (or a senior) may tick", () => {
  const d = deliverable({ ownerId: "p_femi" });
  assert.equal(canTick(d, member), true); // owner
  assert.equal(canTick(d, other), false); // another member
  assert.equal(canTick(d, lead), true); // lead
});

test("you cannot countersign your own attestation", () => {
  const needsSign = item({ state: "checked", requiresCountersign: true, checkedById: "p_ada" });
  // Ada checked it, so Ada may not countersign it — separation of duties.
  assert.equal(canCountersign(needsSign, lead), false);
  assert.equal(canCountersign({ ...needsSign, checkedById: "p_femi" }, lead), true);
  // Members never countersign.
  assert.equal(canCountersign({ ...needsSign, checkedById: "p_ada" }, member), false);
  // Nothing to countersign until it's been checked.
  assert.equal(canCountersign(item({ requiresCountersign: true }), lead), false);
});

test("blocking others finds work held up by a person, oldest first", () => {
  const held = blockingOthers(demoStudio, "p_ada");
  assert.equal(held.length, 1);
  assert.equal(held[0].task.title, "Prepare typography specimen");
});

test("my work excludes finished tasks and sorts by due date", () => {
  const work = myWork(demoStudio, "p_femi");
  assert.ok(work.every((w) => w.task.status !== "done"));
  const dues = work.map((w) => w.task.dueOn ?? "9999");
  assert.deepEqual([...dues].sort(), dues);
});

test("the draft is composed from real events and never invents", () => {
  const project = demoStudio.projects[0];
  const draft = composeDraft(project);
  assert.match(draft, /ready for you to look at: three logo directions/);
  assert.match(draft, /still waiting on 1 thing from you/);
  assert.match(draft, /Pick a direction from the three concepts/);
  // Mentions only deliverables that exist on the project.
  assert.ok(!draft.includes("undefined"));
});

test("a project with nothing to say says so plainly", () => {
  const empty = {
    ...demoStudio.projects[0],
    deliverables: [], tasks: [], clientActions: [], targetEndOn: null,
  };
  assert.match(composeDraft(empty), /Nothing has moved/);
});
