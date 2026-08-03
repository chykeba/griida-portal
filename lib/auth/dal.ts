import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { isLive } from "../db/d1.ts";
import { readSession, type SessionUser } from "./session.ts";
import { studioEquivalentOf } from "./routes.ts";

/**
 * The Data Access Layer.
 *
 * Next's own guidance: the proxy does optimistic checks only, and the real
 * authorisation happens as close to the data as possible. This is that place.
 * Every page that shows anything real calls one of these.
 *
 * `cache()` memoises per render pass, so a page calling requireStudio() in
 * three components makes one D1 round trip, not three. That matters here
 * because we query D1 over HTTP.
 */

/* -------------------------------------------------------------------------- */
/* Demo mode                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * With no database credentials the app serves fixtures and requires no login,
 * so the deployed preview stays usable.
 *
 * The invariant that makes this safe: demo mode is keyed off the *absence* of a
 * database. If there is real data to protect, there are credentials, and if
 * there are credentials, auth is enforced. It cannot be switched on by
 * accident in an environment that has something worth protecting.
 */
export function isDemoMode(): boolean {
  return !isLive();
}

const DEMO_STUDIO_USER: SessionUser = {
  id: "u_chike",
  email: "hellogriida@gmail.com",
  kind: "studio",
  studioRole: "super_admin",
  fullName: "Chike Adebayo",
  firstName: "Chike",
};

const DEMO_CLIENT_USER: SessionUser = {
  id: "u_tunde",
  email: "tunde@ovishealth.com",
  kind: "client",
  studioRole: null,
  fullName: "Tunde Balogun",
  firstName: "Tunde",
};

/* -------------------------------------------------------------------------- */

/** The current user, or null. Memoised for the render pass. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  if (isDemoMode()) return null;
  return readSession();
});

/**
 * Requires a signed-in client. Redirects to sign-in, preserving where they
 * were headed.
 *
 * A studio user is sent to the same project on the studio side rather than
 * shown the client lens. Every client query scopes through
 * `project_client_roles`, and studio people hold no client role — so letting
 * them through only ever produced "We can’t find that page" on a project they
 * had just created. Symmetrical to requireStudio sending a client home: they
 * are authenticated, just looking at the wrong door.
 *
 * This is not a preview. Seeing the portal as the client sees it is a real
 * need — it's the whole ritual behind the access attestation — but it needs a
 * deliberate lens, not a silent fall-through.
 */
export async function requireClientView(path: string): Promise<SessionUser> {
  if (isDemoMode()) return DEMO_CLIENT_USER;
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (user.kind === "studio") redirect(studioEquivalentOf(path));
  return user;
}

/**
 * Requires a studio user. A signed-in *client* hitting a studio route is sent
 * to their own portal rather than to sign-in — they are authenticated, just not
 * entitled, and bouncing them to a login form they've already satisfied is the
 * kind of dead end §6 warns about.
 */
export async function requireStudio(path: string): Promise<SessionUser> {
  if (isDemoMode()) return DEMO_STUDIO_USER;
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (user.kind !== "studio") redirect("/");
  return user;
}

/** For capability checks that need the studio role shape. */
export function asPerson(user: SessionUser) {
  return {
    id: user.id,
    name: user.firstName ?? user.fullName,
    initials: initialsOf(user.fullName),
    role: user.studioRole ?? "member",
  };
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}
