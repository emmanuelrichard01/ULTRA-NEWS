import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import FeedPage from '@/components/FeedPage';
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
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
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

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category } = await params;
  const info = CATEGORY_MAP[category];
  if (!info) notFound();

  return (
    <FeedPage
      edition={EDITIONS_BY_SLUG['']}
      category={category}
      titleOverride={info.displayName}
      taglineOverride={info.description}
      searchParams={searchParams}
    />
  );
}
