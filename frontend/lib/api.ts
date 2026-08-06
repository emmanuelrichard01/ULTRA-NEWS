import { cache } from 'react';

/**
 * ULTRA-NEWS V3 — Centralized API Client
 *
 * Single source of truth for all backend API calls.
 * Uses Next.js server-side fetch with ISR caching.
 */

import type {
  ArticleDetail,
  StoryDetail,
  StoryDetailFull,
  PaginatedResponse,
  SourceInfo,
} from './types';

/**
 * Base URL for browser-initiated requests.
 *
 * Exported because streaming endpoints (/ask, /stream) are called directly from
 * client components and previously each hardcoded their own base — one of them
 * used a relative '/api/v1/ask', which does not exist on the Next.js origin, so
 * that call 404'd every time.
 */
export const BROWSER_API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Base URL for server-side (RSC) fetches.
 *
 * Falls back through: explicit API_URL -> the public URL -> localhost.
 *
 * It used to default straight to `http://backend:8000`, the Docker compose
 * service name. That resolves only inside the compose network, so running
 * `npm run dev` on the host — the ordinary way to work on the frontend — made
 * every server-rendered fetch fail with ENOTFOUND and every story page render
 * as a 404. Defaulting to localhost means the host workflow works untouched,
 * while compose still overrides API_URL to reach the backend container.
 */
const API_URL =
  typeof window === 'undefined'
    ? process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:8000'
    : BROWSER_API_URL;

// ==========================================================================
// Stories
// ==========================================================================

/**
 * Story orderings.
 *
 *   latest        newest first. The only one that paginates — it keys on
 *                 (first_seen_at, id), which never changes once a story exists.
 *   momentum      independent outlets gained inside a recent window. Powers the
 *                 Developing edition.
 *   significance  weight of corroboration. Powers The Record.
 *   velocity      lifetime average outlets/hour. Leaderboard only.
 *
 * All but `latest` are ranking SNAPSHOTS capped to one page. Their sort keys are
 * rewritten continuously by the clustering worker, so paging through them would
 * repeat and drop stories as rows cross the cursor boundary between requests.
 */
export type StorySort = 'latest' | 'momentum' | 'significance' | 'velocity';

export interface FetchStoriesOptions {
  /**
   * Minimum independent publishers. This is the corroboration filter and it
   * maps straight onto the API's `min_sources`, so the number the reader picks
   * is the number the database filters on — no tier lookup in between to drift.
   */
  minSources?: number;
  category?: string;
  cursor?: string;
  limit?: number;
  query?: string;
  sort?: StorySort;
}

export async function fetchStories(
  options: FetchStoriesOptions = {}
): Promise<PaginatedResponse<StoryDetail>> {
  const { minSources, category, cursor, limit = 20, query, sort } = options;

  const params = new URLSearchParams();
  if (minSources && minSources > 1) params.set('min_sources', String(minSources));
  if (category) params.set('category', category);
  if (cursor) params.set('cursor', cursor);
  if (query) params.set('q', query);
  if (sort) params.set('sort', sort);
  params.set('limit', limit.toString());

  try {
    const res = await fetch(`${API_URL}/api/v1/stories?${params.toString()}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      console.error(`[API] fetchStories failed: ${res.status}`);
      return { items: [], count: 0 };
    }
    return res.json();
  } catch (error) {
    console.error('[API] fetchStories error:', error);
    return { items: [], count: 0 };
  }
}

/**
 * Stories ranked by coverage velocity, for the leaderboard.
 *
 * Fetched separately rather than sorted client-side. The leaderboard used to
 * re-sort whatever page of the feed happened to be loaded, so it ranked a
 * 20-story window and called it "fastest moving" — a story accelerating on
 * page 3 simply never appeared.
 */
export async function fetchTrendingStories(
  options: { category?: string; limit?: number } = {}
): Promise<StoryDetail[]> {
  const page = await fetchStories({
    sort: 'velocity',
    limit: options.limit ?? 20,
    category: options.category,
  });
  return page.items;
}

// ==========================================================================
// Story Detail
// ==========================================================================

/**
 * Deduplicated per render pass.
 *
 * `generateMetadata` and the page component both need the story, and without
 * `cache()` that is two round-trips for every story view — Next only dedupes
 * successful, identically-configured `fetch` calls, and a failed one is retried
 * in full.
 */
export const fetchStory = cache(async function fetchStory(
  slug: string
): Promise<StoryDetailFull | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/stories/${encodeURIComponent(slug)}`,
      { next: { tags: [`story:${slug}`, 'story'] } }
    );
    if (!res.ok) {
      if (res.status !== 404) {
        console.error(`[API] fetchStory failed for ${slug}: ${res.status}`);
      }
      return null;
    }
    return res.json();
  } catch (error) {
    console.error(`[API] fetchStory error for ${slug}:`, error);
    return null;
  }
});

// ==========================================================================
// Article Detail
// ==========================================================================

/**
 * Fetch a single article.
 *
 * Lives here rather than inline in the page, which had its own copy pointing at
 * NEXT_PUBLIC_API_URL with `cache: 'no-store'` — a second, subtly different API
 * client that missed every fix applied to this one.
 */
export const fetchArticle = cache(async function fetchArticle(
  slug: string
): Promise<ArticleDetail | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/articles/${encodeURIComponent(slug)}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) {
      if (res.status !== 404) {
        console.error(`[API] fetchArticle failed for ${slug}: ${res.status}`);
      }
      return null;
    }
    return res.json();
  } catch (error) {
    console.error(`[API] fetchArticle error for ${slug}:`, error);
    return null;
  }
});

// ==========================================================================
// Related Stories
// ==========================================================================

export async function fetchRelatedStories(slug: string): Promise<StoryDetail[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/stories/${encodeURIComponent(slug)}/related?limit=5`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

// ==========================================================================
// Sources
// ==========================================================================

export async function fetchSources(): Promise<SourceInfo[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/sources`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
