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
 * Stories accumulating independent coverage fastest, for The Wire's sidebar.
 *
 * Reads `sort=momentum`, NOT `sort=velocity`.
 *
 * This panel used to fetch velocity, and velocity_score is independent_count
 * divided by hours alive — an average over a story's whole life, which ranks
 * NEWEST rather than fastest-spreading. Measured against the live corpus, its
 * top twenty were all single-outlet stories, the leader being a twenty-minute
 * old item scoring 55/hr; a story fifteen newsrooms had confirmed over a day
 * could not place. The panel then filtered to stories with two or more outlets,
 * found that none of its twenty qualified, and rendered nothing — so every
 * reader of The Wire paid for the round trip and got an empty column.
 *
 * `momentum_outlets` is the column built for this question: independent outlets
 * that joined inside a recent window, refreshed when an article joins a cluster
 * and swept every five minutes so it DECAYS as the window slides. It answers
 * "what is being picked up right now", which is what the panel always claimed
 * to show.
 */
export async function fetchMomentumStories(
  options: { category?: string; limit?: number } = {}
): Promise<StoryDetail[]> {
  const page = await fetchStories({
    sort: 'momentum',
    limit: options.limit ?? 8,
    category: options.category,
  });
  return page.items;
}

/**
 * The most recent stories another newsroom has independently confirmed.
 *
 * The Wire is ordered by recency, so its first row is whatever landed most
 * recently — which on a corpus that is overwhelmingly single-source is usually
 * one outlet's unconfirmed report. Handing that the front page's hero spends
 * the loudest promise the product can make on the weakest evidence it has.
 *
 * Asking the API for `sort=latest&min_sources=2&limit=1` gets the front page a
 * lead that is both current and corroborated, which is the judgement a wire
 * editor makes. It is a different question from The Record's, which ranks by
 * weight of evidence and ignores recency — so the two editions do not end up
 * leading with the same story every day.
 */
export async function fetchLeadStories(
  options: { category?: string; limit?: number } = {}
): Promise<StoryDetail[]> {
  const page = await fetchStories({
    sort: 'latest',
    minSources: 2,
    limit: options.limit ?? 5,
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
      // `revalidate` is required alongside the tags, not implied by them.
      // Next 15 changed the fetch default to `no-store`, so a tagged-but-
      // otherwise-unconfigured request is uncached — which also forces the
      // whole route to render on demand. This was the only fetch missing it,
      // and it was the one whose page had precise tag invalidation available:
      // the backend calls the revalidate webhook when a cluster changes, so
      // `revalidateTag('story:<slug>')` drops exactly this entry. The interval
      // is a backstop for a missed webhook.
      { next: { tags: [`story:${slug}`, 'story'], revalidate: 300 } }
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
