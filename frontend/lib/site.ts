/**
 * Site identity — one source of truth for anything that needs an absolute URL.
 *
 * This existed in three places and disagreed with itself. `metadataBase` fell
 * back to `https://ultra-news.demo`, which is not a domain anyone owns, while
 * `openGraph.url` was that same string HARDCODED — so it did not read the
 * environment variable at all. In production every Open Graph card, every
 * canonical hint and every share preview pointed at a domain that does not
 * resolve, regardless of what NEXT_PUBLIC_APP_URL was set to.
 *
 * Sitemap and robots need the same value, and both are new, so this is the
 * moment to stop copying it around.
 */

/** Trailing slashes break URL joins and produce `//path` in sitemaps. */
function normalise(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Resolution order:
 *
 *   NEXT_PUBLIC_APP_URL   what the deployment is actually served as
 *   VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL   set by Vercel automatically,
 *       so a preview or a first deploy still emits correct absolute URLs
 *       before anyone has configured anything
 *   localhost             development
 */
export const SITE_URL = normalise(
  process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000'
);

export const SITE_NAME = 'Ultra News';

export const SITE_DESCRIPTION =
  'Coverage of the same event, grouped, with the number of independent outlets behind it. Ultra News clusters reporting from many newsrooms and shows how many of them independently stand behind a story.';

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Whether this deployment should be indexed.
 *
 * Vercel gives every branch and every commit its own URL. Letting those into a
 * search index splits ranking across dozens of duplicate hosts and can leave a
 * preview outranking production. Only the canonical host invites crawlers.
 */
export const IS_INDEXABLE =
  process.env.VERCEL_ENV === undefined || process.env.VERCEL_ENV === 'production';
