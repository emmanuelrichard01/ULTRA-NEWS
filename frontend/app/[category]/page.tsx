import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import FeedPage from '@/components/FeedPage';
import JsonLd, { breadcrumbList } from '@/components/JsonLd';
import { IS_INDEXABLE, absoluteUrl } from '@/lib/site';
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
  if (!info) return { title: 'Topic not found', robots: { index: false } };

  return {
    title: info.displayName,
    description: info.description,
    alternates: { canonical: `/${category}` },
    openGraph: {
      title: `${info.displayName} — Ultra News`,
      description: info.description,
      url: `/${category}`,
    },
  };
}

export function generateStaticParams() {
  return Object.keys(CATEGORY_MAP).map((category) => ({ category }));
}

// Prerendered per topic via generateStaticParams, revalidated on an interval.
// See app/page.tsx for why the `searchParams` prop is deliberately absent.
export const revalidate = 60;

/**
 * Topics are a fixed set, all listed by generateStaticParams. Anything else is
 * a real 404, answered before rendering begins. Without this an unknown path
 * like /nope rendered the not-found page with a 200 and "index, follow" — the
 * root loading.tsx starts streaming before notFound() runs, so the status is
 * already sent — and search engines index it as a thin duplicate page.
 */
export const dynamicParams = false;

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

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': absoluteUrl(`/${category}#page`),
        url: absoluteUrl(`/${category}`),
        name: `${info.displayName} — Ultra News`,
        description: info.description,
        isPartOf: { '@id': absoluteUrl('/#website') },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: initialStories.items.slice(0, 10).map((story, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: absoluteUrl(`/story/${story.slug}`),
            name: story.title,
          })),
        },
      },
      breadcrumbList([
        ['The Wire', '/'],
        [info.displayName, `/${category}`],
      ]),
    ],
  };

  return (
    <Suspense fallback={null}>
      {IS_INDEXABLE && <JsonLd data={structuredData} />}
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
