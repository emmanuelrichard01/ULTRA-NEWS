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

export interface StoryDetailFull extends Omit<StoryDetail, 'sources' | 'image_url'> {
  articles: StoryArticle[];
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

export const CATEGORY_MAP: Record<string, CategoryInfo> = {
  tech: { slug: 'tech', displayName: 'Tech', description: 'Technology, AI, and the digital frontier.' },
  politics: { slug: 'politics', displayName: 'Politics', description: 'Government, policy, and global affairs.' },
  business: { slug: 'business', displayName: 'Business', description: 'Markets, finance, and entrepreneurship.' },
  entertainment: { slug: 'entertainment', displayName: 'Culture', description: 'Film, music, media, and the cultural conversation.' },
  science: { slug: 'science', displayName: 'Science', description: 'Research, discovery, and the natural world.' },
  art: { slug: 'art', displayName: 'Art', description: 'Visual arts, exhibitions, and creative expression.' },
  sports: { slug: 'sports', displayName: 'Sports', description: 'Football, Olympics, and the global arena.' },
  health: { slug: 'health', displayName: 'Health', description: 'Medicine, public health, and wellness.' },
  world: { slug: 'world', displayName: 'World', description: 'Diplomacy, conflict, and international affairs.' },
};
