import type { MetadataRoute } from 'next';

import { IS_INDEXABLE, SITE_URL, absoluteUrl } from '@/lib/site';

/**
 * robots.txt
 *
 * The site had none, which means crawlers applied their own defaults: every
 * route fair game, no sitemap hint, and — on Vercel — every preview deployment
 * and every branch URL indexable alongside production, splitting ranking across
 * duplicate hosts.
 *
 * Served from a route rather than a static file so the sitemap URL and the
 * indexability decision come from the same place as everything else that needs
 * them. See lib/site.ts.
 */
export default function robots(): MetadataRoute.Robots {
  if (!IS_INDEXABLE) {
    // Previews and branch deployments: visible to anyone with the link, absent
    // from search.
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Internal endpoints. `/api/revalidate` is a webhook that takes a
          // secret; there is nothing to index and no reason to advertise it.
          '/api/',
          // A retired tier route kept alive as a redirect to the equivalent
          // corroboration filter. Indexing it would compete with the edition
          // it forwards to.
          '/reporting',
          // Filtered and paginated variants of pages that are already indexed
          // in their canonical form. Left crawlable but not worth surfacing as
          // separate results.
          '/*?cursor=',
          '/*?sources=',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: SITE_URL,
  };
}
