/**
 * Voice layer checks. Run: npm run test:copy
 *
 * These assert the *phrasing*, not just the logic — the whole point of
 * lib/copy.ts is that it sounds like a person, so the phrasing is the contract.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  ordinal,
  listSentence,
  count,
  naturalDate,
  naturalAge,
  deadline,
  healthCopy,
  rollUpHealth,
  roundsCopy,
  daysBetween,
} from "./copy.ts";

// A fixed "now" so these never break at midnight or on the 31st.
const NOW = new Date(2026, 6, 29, 10, 0, 0); // Wed 29 July 2026
const at = (y: number, m: number, d: number) => new Date(y, m, d, 12, 0, 0);

test("ordinal handles the awkward teens", () => {
  assert.equal(ordinal(1), "1st");
  assert.equal(ordinal(2), "2nd");
  assert.equal(ordinal(3), "3rd");
  assert.equal(ordinal(11), "11th");
  assert.equal(ordinal(12), "12th");
  assert.equal(ordinal(13), "13th");
  assert.equal(ordinal(17), "17th");
  assert.equal(ordinal(21), "21st");
  assert.equal(ordinal(23), "23rd");
});

test("listSentence reads aloud correctly", () => {
  assert.equal(listSentence(["logo"]), "logo");
  assert.equal(listSentence(["logo", "icons"]), "logo and icons");
  assert.equal(listSentence(["logo", "icons", "type"]), "logo, icons and type");
});

test("count keeps number and noun together", () => {
  assert.equal(count(1, "round"), "1 round");
  assert.equal(count(3, "round"), "3 rounds");
  assert.equal(count(2, "person", "people"), "2 people");
});

test("naturalDate says what a person would say", () => {
  assert.equal(naturalDate(at(2026, 6, 29), NOW), "today");
  assert.equal(naturalDate(at(2026, 6, 30), NOW), "tomorrow");
  assert.equal(naturalDate(at(2026, 6, 28), NOW), "yesterday");
  // Fri 31 July is 2 days out — day name
  assert.equal(naturalDate(at(2026, 6, 31), NOW), "this Friday");
  // The phrasing the brief asked for, verbatim
  assert.equal(naturalDate(at(2026, 6, 17), NOW), "the 17th of this month");
  assert.equal(naturalDate(at(2026, 7, 17), NOW), "the 17th of next month");
  assert.equal(naturalDate(at(2026, 9, 3), NOW), "3 October");
  assert.equal(naturalDate(at(2027, 1, 3), NOW), "3 February 2027");
});

test("naturalAge degrades gracefully", () => {
  assert.equal(naturalAge(new Date(NOW.getTime() - 10_000), NOW), "just now");
  assert.equal(naturalAge(new Date(NOW.getTime() - 20 * 60_000), NOW), "20 minutes ago");
  assert.equal(naturalAge(new Date(NOW.getTime() - 3 * 3_600_000), NOW), "3 hours ago");
  assert.equal(naturalAge(at(2026, 6, 28), NOW), "yesterday");
  assert.equal(naturalAge(at(2026, 6, 26), NOW), "3 days ago");
  assert.equal(naturalAge(at(2026, 6, 20), NOW), "last week");
});

test("deadline speaks in whole sentences", () => {
  assert.equal(deadline(at(2026, 6, 29), NOW).sentence, "This is due today.");
  assert.equal(deadline(at(2026, 6, 30), NOW).sentence, "This is due tomorrow.");
  assert.equal(
    deadline(at(2026, 7, 17), NOW).sentence,
    "This is due on the 17th of next month.",
  );
  assert.equal(deadline(at(2026, 6, 28), NOW).sentence, "This was due yesterday.");
  assert.equal(
    deadline(at(2026, 6, 26), NOW).sentence,
    "This was due last Sunday — 3 days ago.",
  );
});

test("deadline contracts like speech", () => {
  assert.equal(deadline(at(2026, 7, 12), NOW, "It").sentence, "It’s due on the 12th of next month.");
  assert.equal(deadline(at(2026, 6, 30), NOW, "It").sentence, "It’s due tomorrow.");
  // Past tense doesn’t contract the same way
  assert.equal(deadline(at(2026, 6, 28), NOW, "It").sentence, "It was due yesterday.");
});

test("deadline short form stays grammatical", () => {
  // "the"-phrases need the preposition; day names must not have it
  assert.equal(deadline(at(2026, 7, 12), NOW).short, "Due on the 12th of next month");
  assert.equal(deadline(at(2026, 6, 31), NOW).short, "Due this Friday");
  assert.equal(deadline(at(2026, 6, 30), NOW).short, "Due tomorrow");
  assert.equal(deadline(at(2026, 6, 29), NOW).short, "Due today");
  assert.equal(deadline(at(2026, 9, 3), NOW).short, "Due 3 October");
});

test("deadline urgency escalates", () => {
  assert.equal(deadline(at(2026, 6, 26), NOW).urgency, "overdue");
  assert.equal(deadline(at(2026, 6, 29), NOW).urgency, "today");
  assert.equal(deadline(at(2026, 6, 31), NOW).urgency, "soon");
  assert.equal(deadline(at(2026, 8, 15), NOW).urgency, "calm");
  assert.equal(deadline(at(2026, 6, 26), NOW).isOverdue, true);
});

test("health always pairs status with a date", () => {
  const h = healthCopy("on_track", "Concepts land Thursday.", at(2026, 7, 17), NOW);
  assert.equal(h.headline, "This project is on track.");
  assert.equal(h.detail, "Concepts land Thursday. It’s due on the 17th of next month.");
  assert.equal(h.tone, "calm");

  assert.equal(healthCopy("at_risk").headline, "This one needs a little attention.");
  assert.equal(healthCopy("blocked").tone, "alert");
});

test("roll-up puts the client’s own obligations first", () => {
  assert.equal(rollUpHealth(["on_track"], 0).headline, "Everything’s on track.");
  assert.equal(rollUpHealth(["on_track", "on_track"], 0).headline, "All your projects are on track.");
  // Client’s own to-dos outrank a red project — §3, "make their blockers unmissable"
  assert.equal(rollUpHealth(["blocked"], 2).headline, "2 things need you.");
  assert.equal(rollUpHealth(["blocked"], 0).headline, "One project is held up.");
  assert.equal(rollUpHealth([], 0).headline, "Nothing running right now.");
});

test("rounds counter is honest about scope", () => {
  assert.equal(roundsCopy(1, 2).label, "Round 1 of 2");
  assert.equal(roundsCopy(1, 2).note, "1 more round included after this one.");
  assert.equal(roundsCopy(2, 2).note, "This is the last round included in your agreement.");
  assert.equal(roundsCopy(3, 2).isBeyondScope, true);
  assert.match(roundsCopy(3, 2).note, /confirm the cost with you before starting/);
});

test("daysBetween is timezone-safe across a DST boundary", () => {
  // Late March in the northern hemisphere — clocks shift inside this range
  assert.equal(daysBetween(at(2026, 2, 28), at(2026, 2, 30)), 2);
  assert.equal(daysBetween(at(2026, 9, 24), at(2026, 9, 26)), 2);
});
