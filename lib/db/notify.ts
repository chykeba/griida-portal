import "server-only";

import { query } from "./d1.ts";
import { isEmailConfigured, sendReviewReady, sendTeamInvite, sendUpdate } from "../email/send.ts";
import { randomToken } from "../auth/tokens.ts";
import { issueNotificationLink } from "../auth/links.ts";

/**
 * Telling the client something happened.
 *
 * Clients do not visit portals; they respond to notifications. §6b's whole
 * mobile flow — notification, deep link, decide — starts here, so a portal
 * without this is a filing cabinet nobody opens.
 *
 * Two rules:
 *   - **Email failure never fails the write.** If SES is down, the update is
 *     still published and the work still moves. A notification is a courtesy on
 *     top of a fact, not the fact itself.
 *   - **But it is never silent.** These used to log to the server console and
 *     return nothing, so the studio saw "Published" while nothing had reached
 *     anyone — and the reason (usually SES still being in the sandbox, where it
 *     will only send to verified addresses) sat in a log nobody reads. Every
 *     function here reports what happened so the caller can say so.
 *   - **Never notify the person who acted.** The studio member who published
 *     doesn't need an email telling them they published.
 */

const APP_URL = process.env.APP_URL ?? "https://griida-portal.vercel.app";

export interface Delivery {
  sent: string[];
  failed: { email: string; reason: string }[];
  /** True when SES isn't configured at all, so nothing was even attempted. */
  notConfigured: boolean;
}

/** One line a studio person can act on, or null when everything landed. */
export function deliveryProblem(d: Delivery): string | null {
  if (d.notConfigured) return "Email isn’t configured, so nobody was notified.";
  if (d.failed.length === 0) return null;
  const who = d.failed.map((f) => f.email).join(", ");
  return `Couldn’t email ${who}. ${d.failed[0].reason}`;
}

interface Recipient {
  id: string;
  email: string;
  firstName: string;
}

async function clientsOn(projectId: string, exclude: string): Promise<Recipient[]> {
  const rows = await query<{ id: string; email: string; first_name: string | null; full_name: string }>(
    `SELECT u.id, u.email, u.first_name, u.full_name
       FROM project_client_roles r
       JOIN users u ON u.id = r.user_id
      WHERE r.project_id = ?1 AND u.is_active = 1 AND u.kind = 'client' AND u.id != ?2`,
    [projectId, exclude],
  );
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.first_name ?? r.full_name.split(" ")[0],
  }));
}

async function record(
  userId: string,
  kind: string,
  title: string,
  body: string | null,
  deepLink: string,
): Promise<void> {
  await query(
    `INSERT INTO notifications (id, user_id, kind, title, body, deep_link, emailed_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))`,
    [`ntf_${randomToken(8)}`, userId, kind, title, body, deepLink],
  );
}

/** Work has moved to the client for review. */
export async function notifyReviewReady(params: {
  projectId: string;
  projectSlug: string;
  projectName: string;
  deliverableId: string;
  deliverableName: string;
  actorId: string;
}): Promise<Delivery> {
  const path = `/p/${params.projectSlug}/review/${params.deliverableId}`;

  // The lookup itself is inside the guard. It was outside, which meant a
  // database hiccup here failed a write that had already succeeded — the exact
  // opposite of what this module promises.
  const delivery: Delivery = { sent: [], failed: [], notConfigured: !isEmailConfigured() };

  let recipients: Recipient[] = [];
  try {
    recipients = await clientsOn(params.projectId, params.actorId);
  } catch (error) {
    console.error("[notify] couldn’t look up recipients:", error);
    delivery.failed.push({ email: "the client list", reason: "We couldn’t look up who to tell." });
    return delivery;
  }

  for (const person of recipients) {
    try {
      // One link per person, because it signs that person in. Minted inside
      // the try so a token is never issued for a mail that then fails to send.
      const url = await issueNotificationLink(person.id, path, APP_URL);
      await sendReviewReady(person.email, {
        firstName: person.firstName,
        projectName: params.projectName,
        deliverableName: params.deliverableName,
        url,
      });
      await record(person.id, "review_ready", `Ready for you: ${params.deliverableName}`, null, path);
      delivery.sent.push(person.email);
    } catch (error) {
      // Reported, not thrown. The work has already moved — but the studio is
      // told, because "sent" and "silently didn't send" must not look alike.
      console.error(`[notify] review-ready to ${person.email} failed:`, error);
      delivery.failed.push({
        email: person.email,
        reason: error instanceof Error ? error.message : "Unknown error.",
      });
    }
  }
  return delivery;
}

/** An update has been published. */
export async function notifyUpdatePublished(params: {
  projectId: string;
  projectSlug: string;
  projectName: string;
  body: string;
  actorId: string;
}): Promise<Delivery> {
  const path = `/p/${params.projectSlug}`;

  // The lookup itself is inside the guard. It was outside, which meant a
  // database hiccup here failed a write that had already succeeded — the exact
  // opposite of what this module promises.
  const delivery: Delivery = { sent: [], failed: [], notConfigured: !isEmailConfigured() };

  let recipients: Recipient[] = [];
  try {
    recipients = await clientsOn(params.projectId, params.actorId);
  } catch (error) {
    console.error("[notify] couldn’t look up recipients:", error);
    delivery.failed.push({ email: "the client list", reason: "We couldn’t look up who to tell." });
    return delivery;
  }

  for (const person of recipients) {
    try {
      const url = await issueNotificationLink(person.id, path, APP_URL);
      await sendUpdate(person.email, {
        firstName: person.firstName,
        projectName: params.projectName,
        body: params.body,
        url,
      });
      await record(person.id, "update_published", `${params.projectName} — an update`, params.body, path);
      delivery.sent.push(person.email);
    } catch (error) {
      console.error(`[notify] update to ${person.email} failed:`, error);
      delivery.failed.push({
        email: person.email,
        reason: error instanceof Error ? error.message : "Unknown error.",
      });
    }
  }
  return delivery;
}

/**
 * Telling a new teammate they exist here.
 *
 * Before this, inviting someone wrote a user row and stopped. They could sign
 * in — the magic link works the moment the row exists — but nothing told them
 * the studio was there or where to find it, so an invite was a private event.
 *
 * Same rule as everything else in this file: a failed send is logged, never
 * fatal. They are on the team either way; the email is how they find out.
 */
export async function notifyTeamInvite(params: {
  email: string;
  fullName: string;
  invitedBy: string;
  roleLabel: string;
  roleBlurb: string;
}): Promise<void> {
  try {
    await sendTeamInvite(params.email, {
      firstName: params.fullName.split(/\s+/)[0],
      invitedBy: params.invitedBy,
      roleLabel: params.roleLabel,
      roleBlurb: params.roleBlurb,
      loginUrl: `${APP_URL}/login`,
    });
  } catch (error) {
    console.error("[notify] couldn’t send the team invite:", error);
  }
}
