import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext adapter config — runs the Next.js app on Cloudflare Workers.
 *
 * Caching is deliberately left at defaults for now. Once the portal reads from
 * Supabase, revisit this: client pages are per-user and must never be cached at
 * the edge, or one client could be served another's project. The RLS boundary
 * (Architecture-and-Schema.md §2.2) protects the database, not a CDN cache.
 */
export default defineCloudflareConfig();
