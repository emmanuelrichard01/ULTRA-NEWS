import type { Metadata } from 'next';
import { Suspense } from 'react';

import FeedPage from '@/components/FeedPage';
import { EDITIONS_BY_SLUG } from '@/lib/editions';
import { fetchStories } from '@/lib/api';

const edition = EDITIONS_BY_SLUG['developing'];

export const metadata: Metadata = {
  title: edition.name,
  description: edition.tagline,
};

// Prerendered and revalidated on an interval — see app/page.tsx for why the
// `searchParams` prop is deliberately absent.
export const revalidate = 60;

export default async function DevelopingPage() {
  const initialStories = await fetchStories({
    sort: edition.sort,
    minSources: edition.minSources,
  });

  return (
    <Suspense fallback={null}>
      <FeedPage edition={edition} initialStories={initialStories} />
    </Suspense>
  );
}
