/**
 * Email bodies.
 *
 * Pure functions, so the wording is testable without sending anything.
 *
 * The sign-in email is often a client's first contact with the portal, so it
 * gets the same discipline as the product (§6a): plain language, one obvious
 * action, no marketing chrome, no logo soup. If it looks like a newsletter it
 * gets filed like one.
 *
 * HTML deliberately stays primitive — inline styles, system fonts, no external
 * assets. Email clients are not browsers, custom fonts mostly don't load, and
 * a remote image is a tracking pixel as far as most spam filters are concerned.
 */

export interface EmailBody {
  subject: string;
  text: string;
  html: string;
}

const INK = "#0a0d14";
const SOFT = "#3d4452";
const FAINT = "#5a6170";
const RULE = "#e5e1d9";

function shell(inner: string, why = "you're working with Griida on a project"): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
</head>
<body style="margin:0;padding:24px;background:#fbfaf8;">
<div style="max-width:520px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${INK};">
${inner}
<hr style="border:0;border-top:1px solid ${RULE};margin:28px 0 14px;">
<p style="margin:0;font-size:13px;line-height:1.5;color:${FAINT};">
Griida — you're getting this because ${why}.
</p>
</div></body></html>`;
}

/** The magic-link email. */
export function magicLinkEmail(url: string): EmailBody {
  const text = [
    "Here's your link to sign in to your Griida portal:",
    "",
    url,
    "",
    "It works once and lasts an hour.",
    "",
    "If you didn't ask for this you can ignore it — the link is useless to",
    "anyone who doesn't have your inbox, and nothing has changed on your account.",
  ].join("\n");

  const html = shell(`
<p style="margin:0 0 18px;">Here's your link to sign in to your Griida portal.</p>
<p style="margin:0 0 22px;">
  <a href="${escapeAttr(url)}"
     style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;
            padding:13px 22px;border-radius:8px;font-weight:500;">Sign in</a>
</p>
<p style="margin:0 0 18px;font-size:14px;color:${SOFT};">
  It works once and lasts an hour.
</p>
<p style="margin:0 0 6px;font-size:13px;color:${FAINT};">
  If the button doesn't work, paste this into your browser:
</p>
<p style="margin:0;font-size:13px;word-break:break-all;">
  <a href="${escapeAttr(url)}" style="color:${SOFT};">${escapeHtml(url)}</a>
</p>
<p style="margin:18px 0 0;font-size:14px;color:${SOFT};">
  If you didn't ask for this you can ignore it — nothing has changed on your account.
</p>`, "someone asked for a sign-in link to your project portal");

  return { subject: "Your sign-in link", text, html };
}

/** Told there's something to look at. Kept short on purpose. */
export function reviewReadyEmail(params: {
  firstName: string;
  projectName: string;
  deliverableName: string;
  url: string;
}): EmailBody {
  const { firstName, projectName, deliverableName, url } = params;
  const text = [
    `Hi ${firstName},`,
    "",
    `There's something ready for you to look at on ${projectName}: ${deliverableName}.`,
    "",
    "This link signs you in and works once — please don't forward it:",
    url,
    "",
    "No rush — but it's holding up the next bit, so the sooner the better.",
  ].join("\n");

  const html = shell(`
<p style="margin:0 0 18px;">Hi ${escapeHtml(firstName)},</p>
<p style="margin:0 0 22px;">
  There's something ready for you to look at on
  <strong>${escapeHtml(projectName)}</strong>: ${escapeHtml(deliverableName)}.
</p>
<p style="margin:0 0 22px;">
  <a href="${escapeAttr(url)}"
     style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;
            padding:13px 22px;border-radius:8px;font-weight:500;">Take a look</a>
</p>
<p style="margin:16px 0 0;font-size:13px;color:${FAINT};">
  That button signs you straight in — no password, nothing to set up. It’s
  yours alone and works once, so please don’t forward it.
</p>
<p style="margin:0;font-size:14px;color:${SOFT};">
  No rush — but it's holding up the next bit, so the sooner the better.
</p>`);

  return { subject: `Ready for you: ${deliverableName}`, text, html };
}

/** A published update. Leads with what changed, not with "we have news". */
export function updatePublishedEmail(params: {
  firstName: string;
  projectName: string;
  body: string;
  url: string;
}): EmailBody {
  const { firstName, projectName, body, url } = params;
  const text = [
    `Hi ${firstName},`,
    "",
    `An update on ${projectName}:`,
    "",
    body,
    "",
    `See it in your portal — this link signs you in and works once:`,
    url,
  ].join("\n");

  const html = shell(`
<p style="margin:0 0 18px;">Hi ${escapeHtml(firstName)},</p>
<p style="margin:0 0 8px;font-size:14px;color:${FAINT};">An update on ${escapeHtml(projectName)}</p>
<div style="margin:0 0 22px;padding-left:14px;border-left:2px solid ${RULE};">
  ${escapeHtml(body).replace(/\n/g, "<br>")}
</div>
<p style="margin:0;">
  <a href="${escapeAttr(url)}"
     style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;
            padding:12px 20px;border-radius:8px;font-weight:500;">Open your portal</a>
</p>
<p style="margin:16px 0 0;font-size:13px;color:${FAINT};">
  That button signs you straight in — no password, nothing to set up. It’s
  yours alone and works once, so please don’t forward it.
</p>`);

  return { subject: `${projectName} — an update`, text, html };
}

/**
 * Telling someone they’ve been added to the studio.
 *
 * Deliberately not a sign-in link. A magic link lasts an hour, and an invite
 * is read whenever the person next opens their inbox — a dead link is a poor
 * first thing to know about a tool. They ask for their own from the login
 * page, which also proves the address works.
 */
export function teamInviteEmail(params: {
  firstName: string;
  invitedBy: string;
  roleLabel: string;
  roleBlurb: string;
  loginUrl: string;
}): EmailBody {
  const { firstName, invitedBy, roleLabel, roleBlurb, loginUrl } = params;
  const text = [
    `Hi ${firstName},`,
    "",
    `${invitedBy} has added you to Griida Studio — where we run projects and`,
    "the client portal that goes with them.",
    "",
    `You’re a ${roleLabel.toLowerCase()}: ${roleBlurb}`,
    "",
    `Sign in here — enter this email address and we’ll send you a link:`,
    loginUrl,
    "",
    "No password to set up.",
  ].join("\n");

  const html = shell(`
<p style="margin:0 0 18px;">Hi ${escapeHtml(firstName)},</p>
<p style="margin:0 0 18px;">
  ${escapeHtml(invitedBy)} has added you to <strong>Griida Studio</strong> — where we
  run projects and the client portal that goes with them.
</p>
<p style="margin:0 0 22px;font-size:14px;color:${SOFT};">
  You’re a ${escapeHtml(roleLabel.toLowerCase())}: ${escapeHtml(roleBlurb)}
</p>
<p style="margin:0 0 18px;">
  <a href="${escapeAttr(loginUrl)}"
     style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;
            padding:13px 22px;border-radius:8px;font-weight:500;">Sign in</a>
</p>
<p style="margin:0;font-size:14px;color:${SOFT};">
  Enter this email address and we’ll send you a link. There’s no password to set up.
</p>`, `${escapeHtml(invitedBy)} added you to the Griida studio`);

  return { subject: `${invitedBy} added you to Griida Studio`, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
