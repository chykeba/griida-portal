import "server-only";

import { query } from "../db/d1.ts";
import { hash, notifyLinkExpiry, randomToken, safeNext } from "./tokens.ts";

/**
 * Minting sign-in links to put inside emails.
 *
 * Separate from session.ts because that module reaches for `next/headers` to
 * read and write the session cookie, and this one has no request to work with
 * — it runs while composing an email. Keeping them apart also keeps this
 * usable from anywhere a notification is sent.
 */

/**
 * A one-click way into the thing we just emailed someone about.
 *
 * The flow this replaces asked a client to prove they owned the inbox the
 * email had just been delivered to: click "Open your portal", type your
 * address, wait for a second email, click again. The second round trip
 * established nothing the first had not.
 *
 * Takes a user id rather than an address, because the caller has already
 * decided who to tell and why — there is no address to probe here, so the
 * deliberate ambiguity in `issueMagicLink` isn't needed. There is no rate
 * limit either: this isn't user-triggered, and the volume is bounded by how
 * often the studio publishes.
 *
 * `next` travels in the URL, not the token, and `landingFor` re-validates it
 * when the link is consumed — so tampering can change where someone lands,
 * never who they are, and never off-site.
 */
export async function issueNotificationLink(
  userId: string,
  next: string,
  origin: string,
): Promise<string> {
  const token = randomToken();
  await query(
    `INSERT INTO auth_tokens (token, user_id, expires_at, purpose) VALUES (?1, ?2, ?3, 'notify')`,
    // Only the hash is stored. A database leak yields nothing presentable.
    [await hash(token), userId, notifyLinkExpiry()],
  );
  return `${origin}/auth/verify?token=${token}&next=${encodeURIComponent(safeNext(next, "/"))}`;
}
