/**
 * Parsing pasted schedules.
 *
 * Pure, so it's tested directly. The input is whatever a person's clipboard
 * holds after they select a column in a spreadsheet, which is messier than any
 * format we would design.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { parseScheduleLines } from "./schedule-writes.ts";

const TODAY = new Date("2026-08-07T00:00:00Z");

test("a spreadsheet paste — tab separated — comes through dated", () => {
  const rows = parseScheduleLines(
    ["Homepage\t8/6/2026", "About Hust\t8/8/2026", "Academics\t8/10/2026"].join("\n"),
    TODAY,
  );
  assert.deepEqual(
    rows.map((r) => [r.name, r.dueOn]),
    [
      ["Homepage", "2026-08-06"],
      ["About Hust", "2026-08-08"],
      ["Academics", "2026-08-10"],
    ],
  );
});

test("hand-typed commas work, and names containing commas survive", () => {
  const rows = parseScheduleLines("Business, Law & Education, 8/25/2026", TODAY);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Business, Law & Education");
  assert.equal(rows[0].dueOn, "2026-08-25");
});

test("an item with no date is still an item", () => {
  const rows = parseScheduleLines("Apply Now", TODAY);
  assert.deepEqual(rows, [{ name: "Apply Now", dueOn: null, problem: null }]);
});

test("a date it can’t read is reported, never guessed and never dropped", () => {
  // The sheet that prompted this feature really did contain 8/30/20206.
  const rows = parseScheduleLines("Apply Now\t8/30/20206", TODAY);
  assert.equal(rows.length, 1, "the line must not vanish");
  assert.equal(rows[0].name, "Apply Now");
  assert.equal(rows[0].dueOn, null);
  assert.match(rows[0].problem ?? "", /Couldn’t read/);
});

test("impossible dates are refused rather than rolled over", () => {
  // JS Date turns 2 February 31st into 3 March without complaint.
  for (const bad of ["2/31/2026", "13/1/2026", "2026-02-30"]) {
    const [row] = parseScheduleLines(`Thing\t${bad}`, TODAY);
    assert.equal(row.dueOn, null, `${bad} is not a date`);
    assert.ok(row.problem, `${bad} must be flagged`);
  }
});

test("ISO dates and blank lines", () => {
  const rows = parseScheduleLines("\n  Homepage\t2026-08-06  \n\n\nBlog\n", TODAY);
  assert.deepEqual(
    rows.map((r) => [r.name, r.dueOn]),
    [
      ["Homepage", "2026-08-06"],
      ["Blog", null],
    ],
  );
});

test("written dates assume the current year", () => {
  const [row] = parseScheduleLines("Homepage\tAugust 6", TODAY);
  assert.equal(row.dueOn, "2026-08-06");
});
