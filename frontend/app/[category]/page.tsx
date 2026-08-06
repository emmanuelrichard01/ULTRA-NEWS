import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import FeedPage from '@/components/FeedPage';
import { fetchStories, fetchLeadStories } from '@/lib/api';
import { EDITIONS_BY_SLUG } from '@/lib/editions';
import { CATEGORY_MAP } from '@/lib/types';

/**
 * Topic feed.
 *
 * Reuses FeedPage rather than reimplementing the feed. The previous version
 * hand-rolled its own cursor pagination (a "Load more" anchor that reloaded the
 * whole page), its own header and its own card loop — so the corroboration
 * filter, infinite scroll and sort controls simply did not exist on topic
 * pages, and the section heading claimed "Sorted by Trending Velocity" while
 * the API returned a different ordering entirely.
 */

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const info = CATEGORY_MAP[category];
  if (!info) return { title: 'Topic not found' };

  return {
    title: info.displayName,
    description: info.description,
    openGraph: {
      title: `${info.displayName} — Ultra News`,
      description: info.description,
    },
  };
}

export function generateStaticParams() {
  return Object.keys(CATEGORY_MAP).map((category) => ({ category }));
}

// Prerendered per topic via generateStaticParams, revalidated on an interval.
// See app/page.tsx for why the `searchParams` prop is deliberately absent.
export const revalidate = 60;

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const info = CATEGORY_MAP[category];
  if (!info) notFound();

  const edition = EDITIONS_BY_SLUG[''];

  // Leads are scoped to the topic, so a Climate page leads with the newest
  // confirmed climate stories rather than with the front page's.
  const [initialStories, leadStories] = await Promise.all([
    fetchStories({ sort: edition.sort, minSources: edition.minSources, category }),
    fetchLeadStories({ category, limit: 4 }),
  ]);

  return (
    <Suspense fallback={null}>
      <FeedPage
        edition={edition}
        category={category}
        titleOverride={info.displayName}
        taglineOverride={info.description}
        initialStories={initialStories}
        leadStories={leadStories}
      />
    </Suspense>
  );
}
