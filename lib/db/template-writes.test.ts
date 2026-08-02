import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * The versioning rule is asserted against the source, because it is a
 * statement about SQL rather than about a pure function — and getting it
 * wrong silently rewrites the standard every past project claims to have met.
 */
const SOURCE = fs.readFileSync(
  path.join(import.meta.dirname, "template-writes.ts"),
  "utf8",
);

test("every mutation refuses to touch a published template", () => {
  // assertDraft is the guard. Each editing function must call it first.
  for (const fn of ["addItem", "updateItem", "removeItem", "publishTemplate", "discardDraft"]) {
    const body = SOURCE.slice(SOURCE.indexOf(`export async function ${fn}`));
    const upToNext = body.slice(0, body.indexOf("\nexport ", 10));
    assert.match(
      upToNext,
      /await assertDraft\(templateId\)/,
      `${fn} doesn't check the template is still a draft`,
    );
  }
});

test("editing a published version creates the next one rather than mutating it", () => {
  const fn = SOURCE.slice(SOURCE.indexOf("export async function editableDraftFor"));
  // A new row at version + 1...
  assert.match(fn, /\(latest\?\.version \?\? 0\) \+ 1/);
  assert.match(fn, /INSERT INTO checklist_templates[\s\S]*'draft'/);
  // ...and the published one is never updated in place.
  assert.ok(
    !/UPDATE checklist_templates SET status = 'draft'/.test(SOURCE),
    "a published template must never be flipped back to draft",
  );
});

test("publishing archives the previous version instead of deleting it", () => {
  const fn = SOURCE.slice(SOURCE.indexOf("export async function publishTemplate"));
  assert.match(fn, /status = 'archived'/);
  assert.ok(
    !/DELETE FROM checklist_templates\s+WHERE deliverable_type_id/.test(fn),
    "history must survive — instances name the version they shipped against",
  );
});

test("an empty checklist cannot be published", () => {
  assert.match(SOURCE, /An empty checklist isn’t a standard/);
});

test("the refusal explains why, naming the version", () => {
  // "Can't edit this" with no reason reads as a bug rather than a rule.
  assert.match(SOURCE, /is published, so it can’t be edited/);
  assert.match(SOURCE, /projects already record having met it/);
});

test("removing an item renumbers in two passes", () => {
  // UNIQUE(template_id, position) trips if you renumber in place, so the
  // positions are parked out of range first. One pass would deadlock on the
  // constraint the moment two items swap.
  const fn = SOURCE.slice(SOURCE.indexOf("export async function removeItem"));
  assert.match(fn, /1000 \+ index/);
  assert.equal(
    (fn.match(/UPDATE checklist_template_items SET position/g) ?? []).length,
    2,
    "expected a park pass and a settle pass",
  );
});
