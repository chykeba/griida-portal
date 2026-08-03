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
