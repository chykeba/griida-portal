/**
 * Route mapping between the two sides of the portal.
 *
 * Pure and dependency-free so it can be tested directly — dal.ts pulls in
 * `server-only` and `next/navigation` and can't be imported outside Next.
 */

/**
 * Where a studio person meant to go when they landed on a client URL.
 *
 * `/p/acme` and `/p/acme/review/dlv_1` both resolve to the studio project
 * page, which is the only studio route keyed by project slug — sending them to
 * `/studio/p/acme/review/dlv_1` would just trade one 404 for another.
 */
export function studioEquivalentOf(path: string): string {
  const slug = /^\/p\/([^/?#]+)/.exec(path)?.[1];
  return slug ? `/studio/p/${slug}` : "/studio";
}

/**
 * Paths that must resolve without a session.
 *
 * Sign-in itself, Next's own assets, and the brand icons. The icons matter
 * because Next serves `app/icon.svg` from a route, not from /public — so
 * without this the proxy redirected the browser's favicon request to /login,
 * which answers with HTML and leaves the tab blank. They carry nothing
 * private; every one of them is served to anyone who loads the login page
 * anyway.
 */
// Prefixes carry their trailing slash so they match a path *segment*. Without
// it "/login" also matched "/logins", and any route that happened to start
// with those letters would have been served to anyone.
const PUBLIC_PREFIXES = ["/login/", "/auth/", "/_next/"];
const PUBLIC_FILES = [
  "/login",
  "/favicon.ico",
  "/icon.svg",
  "/apple-icon.png",
  "/opengraph-image.png",
  "/robots.txt",
  "/manifest.webmanifest",
];

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_FILES.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  );
}
