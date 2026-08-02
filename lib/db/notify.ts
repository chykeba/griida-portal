import "server-only";

import { query } from "./d1.ts";
import { sendReviewReady, sendUpdate } from "../email/send.ts";
import { randomToken } from "../auth/tokens.ts";

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
 *   - **Never notify the person who acted.** The studio member who published
 *     doesn't need an email telling them they published.
 */

const APP_URL = process.env.APP_URL ?? "https://griida-portal.vercel.app";

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
}): Promise<void> {
  const path = `/p/${params.projectSlug}/review/${params.deliverableId}`;
  const url = `${APP_URL}${path}`;

  for (const person of await clientsOn(params.projectId, params.actorId)) {
    try {
      await sendReviewReady(person.email, {
        firstName: person.firstName,
        projectName: params.projectName,
        deliverableName: params.deliverableName,
        url,
      });
      await record(person.id, "review_ready", `Ready for you: ${params.deliverableName}`, null, path);
    } catch (error) {
      // Logged, not thrown. The work has already moved.
      console.error(`[notify] review-ready to ${person.email} failed:`, error);
    }
  }
}

/** An update has been published. */
export async function notifyUpdatePublished(params: {
  projectId: string;
  projectSlug: string;
  projectName: string;
  body: string;
  actorId: string;
}): Promise<void> {
  const path = `/p/${params.projectSlug}`;
  const url = `${APP_URL}${path}`;

  for (const person of await clientsOn(params.projectId, params.actorId)) {
    try {
      await sendUpdate(person.email, {
        firstName: person.firstName,
        projectName: params.projectName,
        body: params.body,
        url,
      });
      await record(person.id, "update_published", `${params.projectName} — an update`, params.body, path);
    } catch (error) {
      console.error(`[notify] update to ${person.email} failed:`, error);
    }
  }
}
