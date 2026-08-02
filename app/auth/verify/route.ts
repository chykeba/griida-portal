import { NextResponse, type NextRequest } from "next/server";
import { consumeMagicLink } from "@/lib/auth/session";
import { landingFor } from "@/lib/auth/tokens";

/**
 * The click target of a magic link.
 *
 * A GET that changes state, which is normally a smell — but it is the only
 * thing an email client can do, and the token is single-use and expiring, so
 * the usual replay concern is handled by the token itself rather than the verb.
 *
 * Nothing here is allowed to throw. This is the first thing a client touches,
 * often on a phone, and a stack trace at the door is the worst possible first
 * impression — so every failure lands on a page that explains itself.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const next = request.nextUrl.searchParams.get("next");

  if (!token) {
    return NextResponse.redirect(new URL("/login?problem=invalid", request.url));
  }

  try {
    const result = await consumeMagicLink(token);

    if (!result.ok) {
      // Say which of the three it was — "expired" and "already used" need
      // different reassurance, and a generic failure teaches nothing.
      return NextResponse.redirect(
        new URL(`/login?problem=${result.reason}`, request.url),
      );
    }

    // landingFor refuses to drop a client into the studio lens, whatever
    // ?next says. The redirect target is never taken on trust.
    return NextResponse.redirect(
      new URL(landingFor(result.user.kind, next), request.url),
    );
  } catch {
    // The database was unreachable, or the credentials are wrong. That is our
    // problem, not theirs, and saying "invalid link" would send them chasing a
    // fault that isn't in their email.
    return NextResponse.redirect(
      new URL("/login?problem=unavailable", request.url),
    );
  }
}
