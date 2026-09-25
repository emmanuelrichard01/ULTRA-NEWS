import type { MetadataRoute } from 'next';

import { fetchStories } from '@/lib/api';
import { EDITIONS, editionHref } from '@/lib/editions';
import { absoluteUrl } from '@/lib/site';
import { CATEGORY_MAP } from '@/lib/types';

/**
 * sitemap.xml
 *
 * The site had none. For a product that generates dozens of new URLs a day and
 * whose story pages are prerendered, that is the single highest-leverage SEO
 * omission: without it, discovery of a new story depends entirely on a crawler
 * finding a link to it before the story falls off the feed's first page.
 *
 * Priorities and change frequencies are set from what each route actually does
 * rather than filled in uniformly. Crawlers treat them as weak hints, so the
 * value is in not lying: The Wire genuinely changes hourly, /terms does not.
 */

// Regenerated on the same interval as the feed it describes.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const editions: MetadataRoute.Sitemap = EDITIONS.map((edition) => ({
    url: absoluteUrl(editionHref(edition)),
    lastModified: now,
    changeFrequency: 'hourly',
    // The Wire is the front page and the entry point for everything else.
    priority: edition.slug === '' ? 1 : 0.9,
  }));

  const topics: MetadataRoute.Sitemap = Object.keys(CATEGORY_MAP).map((slug) => ({
    url: absoluteUrl(`/${slug}`),
    lastModified: now,
    changeFrequency: 'hourly',
    priority: 0.7,
  }));

  const staticPages: MetadataRoute.Sitemap = [
    { path: '/briefing', priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/about', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/rss', priority: 0.5, changeFrequency: 'weekly' as const },
    { path: '/subscribe', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' as const },
    { path: '/terms', priority: 0.2, changeFrequency: 'yearly' as const },
  ].map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  /**
   * Story URLs.
   *
   * Two pages of the feed rather than a deep crawl of the archive. The API caps
   * a page at 50 and rate-limits at 60 requests a minute; a sitemap that walked
   * the whole corpus would spend that budget during a build that is already
   * prerendering sixty story pages against the same limit.
   *
   * `last_updated_at` is the honest lastModified here: a story's page changes
   * whenever another outlet joins the cluster, not when it was first seen.
   */
  let stories: MetadataRoute.Sitemap = [];
  try {
    const [first, record] = await Promise.all([
      fetchStories({ sort: 'latest', limit: 50 }),
      // The best-corroborated stories can be older than two pages of the
      // feed, and they are exactly the pages worth a crawler's time.
      fetchStories({ sort: 'significance', minSources: 3, limit: 50 }),
    ]);
    const second = first.next_cursor
      ? await fetchStories({ sort: 'latest', limit: 50, cursor: first.next_cursor })
      : { items: [] };

    const seen = new Set<string>();
    stories = [...record.items, ...first.items, ...second.items]
      .filter((story) => (seen.has(story.slug) ? false : (seen.add(story.slug), true)))
      .map((story) => ({
        url: absoluteUrl(`/story/${story.slug}`),
        lastModified: new Date(story.last_updated_at),
        changeFrequency: 'daily' as const,
        // Weighted by evidence: corroborated first, lone reports last.
        priority: story.independent_count >= 3 ? 0.8 : story.independent_count === 2 ? 0.6 : 0.4,
        // Image sitemap entries: the lead photograph, as publishers expose it.
        ...(story.image_url ? { images: [story.image_url] } : {}),
      }));
  } catch {
    // A sitemap missing its stories is worth serving; a 500 is not. fetchStories
    // already swallows its own errors and returns an empty page, so this is a
    // backstop for anything it does not catch.
  }

  return [...editions, ...topics, ...staticPages, ...stories];
}
