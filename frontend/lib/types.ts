/**
 * ULTRA-NEWS V3 — Shared TypeScript Types
 *
 * Single source of truth for all API response interfaces.
 * Import from here — never duplicate type definitions in page files.
 */

// ==========================================================================
// Story Types
// ==========================================================================

export interface StoryDetail {
  id: number;
  title: string;
  slug: string;
  summary: string;
  first_seen_at: string;
  last_updated_at: string;
  source_count: number;
  independent_count: number;
  velocity_score: number;
  status: 'wire' | 'developing' | 'corroborated';
  image_url: string | null;
  categories: string[];
  sources: string[];
  framing_preview?: { source: string; title: string; url: string }[];
  /**
   * Independent outlets that picked the story up inside the momentum window.
   * Present only for the Developing edition (`sort=momentum`).
   */
  recent_outlets?: number | null;
}

export interface StoryArticle {
  id: number;
  title: string;
  slug: string;
  url: string;
  excerpt: string;
  image_url?: string;
  published_date: string;
  source: { name: string };
}

export interface AISummary {
  consensus_lead: string;
  outlet_claims: { source: string; claim: string }[];
  discrepancies: string[];
  primary_alignment?: string;
  model?: string;
  synthesized_at?: string;
  articles_count?: number;
  synthesis_type?: string;
}

export interface StoryDetailFull extends Omit<StoryDetail, 'sources' | 'image_url'> {
  articles: StoryArticle[];
  ai_summary?: AISummary | null;
  synthesis_status?: 'idle' | 'pending' | 'completed' | 'failed';
  synthesized_at?: string | null;
}

// ==========================================================================
// Article Types
// ==========================================================================

export interface ArticleDetail {
  id: number;
  title: string;
  slug: string;
  url: string;
  image_url: string | null;
  excerpt: string;
  published_date: string;
  source: { name: string };
  story_slug: string | null;
  story_source_count: number;
  story_status: string;
  categories?: string[];
}

// ==========================================================================
// Source Types
// ==========================================================================

export interface SourceInfo {
  name: string;
  url: string;
  source_type: string;
  /**
   * Ingestion health, classified by the API from failure count and how long
   * since the last SUCCESSFUL fetch. `pending` means registered but not yet
   * fetched — distinct from failing, which a freshly-seeded registry is not.
   */
  health: 'active' | 'stale' | 'failing' | 'pending';
  tier: number;
  tier_label: string;
  region: string;
  region_label: string;
  is_active: boolean;
  last_fetched_at: string | null;
  consecutive_failures: number;
  articles_broken_first: number;
  corroboration_rate: number;
  article_count: number;
}

// ==========================================================================
// Pagination
// ==========================================================================

export interface PaginatedResponse<T> {
  items: T[];
  next_cursor?: string | null;
  count: number;
}

// ==========================================================================
// Category
// ==========================================================================

export interface CategoryInfo {
  slug: string;
  displayName: string;
  description: string;
}

/**
 * Topic taxonomy — must mirror TOPICS in backend/core/topics.py, which is where
 * the classifier's prototypes live and where Category rows are seeded from.
 *
 * Changes from the previous list, driven by measurement on the live corpus:
 *   - `art` is gone. It held 2 articles out of 619; visual art now sits inside
 *     Culture, which also absorbs the old `entertainment` slug.
 *   - `climate` is new. Environment and energy coverage was previously split
 *     between Science and World, which buried a whole beat.
 */
export const CATEGORY_MAP: Record<string, CategoryInfo> = {
  world: { slug: 'world', displayName: 'World', description: 'Diplomacy, conflict, and international affairs.' },
  politics: { slug: 'politics', displayName: 'Politics', description: 'Elections, government, policy and power.' },
  business: { slug: 'business', displayName: 'Business', description: 'Markets, companies, and the economy.' },
  tech: { slug: 'tech', displayName: 'Technology', description: 'Software, hardware, AI and the digital world.' },
  science: { slug: 'science', displayName: 'Science', description: 'Research, discovery and the natural world.' },
  climate: { slug: 'climate', displayName: 'Climate', description: 'Environment, energy and the changing planet.' },
  health: { slug: 'health', displayName: 'Health', description: 'Medicine, public health and wellbeing.' },
  culture: { slug: 'culture', displayName: 'Culture', description: 'Film, music, art and the cultural conversation.' },
  sports: { slug: 'sports', displayName: 'Sports', description: 'Competition, athletes and the global arena.' },
};
