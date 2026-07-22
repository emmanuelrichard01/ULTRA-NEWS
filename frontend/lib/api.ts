/**
 * ULTRA-NEWS V3 — Centralized API Client
 *
 * Single source of truth for all backend API calls.
 * Uses Next.js server-side fetch with ISR caching.
 */

import type {
  StoryDetail,
  StoryDetailFull,
  PaginatedResponse,
  SourceInfo,
} from './types';

// Use internal Docker network URL for server-side fetches, and localhost for client-side
const API_URL = typeof window === 'undefined' 
  ? (process.env.API_URL || 'http://backend:8000') 
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

// ==========================================================================
// Stories
// ==========================================================================

export interface FetchStoriesOptions {
  status?: string;
  category?: string;
  cursor?: string;
  limit?: number;
  query?: string;
}

export async function fetchStories(
  options: FetchStoriesOptions = {}
): Promise<PaginatedResponse<StoryDetail>> {
  const { status, category, cursor, limit = 20, query } = options;

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (category) params.set('category', category);
  if (cursor) params.set('cursor', cursor);
  if (query) params.set('q', query);
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

// ==========================================================================
// Story Detail
// ==========================================================================

export async function fetchStory(slug: string): Promise<StoryDetailFull | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/stories/${slug}`, {
      next: { tags: [`story:${slug}`, 'story'] },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ==========================================================================
// Related Stories
// ==========================================================================

export async function fetchRelatedStories(slug: string): Promise<StoryDetail[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/stories/${slug}/related?limit=5`, {
      next: { revalidate: 300 },
    });
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
