import assert from "node:assert/strict";
import test from "node:test";
import { magicLinkEmail, reviewReadyEmail } from "./content.ts";

const URL = "https://portal.griida.com/auth/verify?token=abc123&next=%2Fp%2Fwebsite";

test("the magic link appears in both parts, unmangled", () => {
  const { text, html } = magicLinkEmail(URL);
  // Text part: bare, so it survives clients that strip HTML.
  assert.ok(text.includes(URL), "link missing from the text part");
  // HTML: in the button href and as visible fallback text.
  assert.ok(html.includes(`href="${URL.replace(/&/g, "&amp;")}"`), "link missing from href");
  assert.equal(
    (html.match(/portal\.griida\.com/g) ?? []).length,
    3,
    "expect the URL in the button href, the fallback href, and the visible fallback",
  );
});

test("query parameters survive HTML escaping", () => {
  // & must become &amp; in markup but still resolve to the original URL.
  const { html } = magicLinkEmail(URL);
  assert.ok(html.includes("token=abc123&amp;next="), "ampersand not escaped in href");
  assert.ok(!html.includes("token=abc123&next="), "raw ampersand left in markup");
});

test("it says the two things a person needs to know", () => {
  const { text } = magicLinkEmail(URL);
  assert.match(text, /works once/, "must say it's single use");
  assert.match(text, /lasts an hour/, "must say how long it lasts");
  // Reassurance for someone who didn't request it — this is the email most
  // likely to be received unexpectedly.
  assert.match(text, /didn't ask for this/);
});

test("no marketing chrome, no tracking, no external assets", () => {
  const { html, subject } = magicLinkEmail(URL);
  assert.ok(!/<img/i.test(html), "no images — a remote image reads as a tracking pixel");
  assert.ok(!/unsubscribe/i.test(html), "transactional mail must not offer unsubscribe");
  assert.ok(!/utm_/i.test(html), "no campaign tracking on a sign-in link");
  // Subject is a statement, not a pitch.
  assert.equal(subject, "Your sign-in link");
  assert.ok(!/!/.test(subject));
});

test("both parts are always present", () => {
  for (const body of [
    magicLinkEmail(URL),
    reviewReadyEmail({
      firstName: "Tunde",
      projectName: "Brand Identity",
      deliverableName: "Three logo directions",
      url: URL,
    }),
  ]) {
    assert.ok(body.text.length > 40, "text part too thin");
    assert.ok(body.html.includes("<!doctype html>"), "html part missing");
    assert.ok(body.subject.length > 0);
  }
});

test("user-supplied values are escaped into the HTML", () => {
  const { html } = reviewReadyEmail({
    firstName: "Tunde",
    projectName: '<script>alert("x")</script>',
    deliverableName: "Logo & wordmark",
    url: URL,
  });
  assert.ok(!html.includes("<script>"), "project name was not escaped");
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("Logo &amp; wordmark"), "ampersand in a name must be escaped");
});

test("the review email leads with what it is, not with the studio", () => {
  const { subject, text } = reviewReadyEmail({
    firstName: "Tunde",
    projectName: "Brand Identity",
    deliverableName: "Three logo directions",
    url: URL,
  });
  assert.equal(subject, "Ready for you: Three logo directions");
  assert.match(text, /Hi Tunde/);
  assert.ok(text.includes(URL));
});
