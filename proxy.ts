import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/tokens";
import { isPublicPath } from "@/lib/auth/routes";

/**
 * Proxy — what Next 16 calls what used to be Middleware.
 *
 * **Optimistic checks only.** It reads the session cookie's presence and an
 * environment variable; it never touches the database, because this runs on
 * every request including prefetches.
 *
 * It is not the security boundary and must never be treated as one. A cookie
 * being present says nothing about whether it is valid, unexpired, or belongs
 * to someone entitled to the page — a forged cookie sails straight through
 * here. The real check is in `lib/auth/dal.ts`, next to the data, on every
 * protected page. This exists so an unauthenticated visitor gets a clean
 * redirect instead of a flash of layout.
 */

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  // Demo mode: no database configured, so there is nothing to protect and no
  // session to have. Reading env is cheap and safe here; a DB call would not be.
  const configured =
    Boolean(process.env.CLOUDFLARE_ACCOUNT_ID) &&
    Boolean(process.env.CLOUDFLARE_D1_DATABASE_ID) &&
    Boolean(process.env.CLOUDFLARE_API_TOKEN);
  if (!configured) return NextResponse.next();

  if (request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Recommended for auth: run everywhere, and let the block above opt out.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
