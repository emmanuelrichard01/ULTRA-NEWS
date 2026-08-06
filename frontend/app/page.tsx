import { Suspense } from 'react';

import FeedPage from '@/components/FeedPage';
import { EDITIONS_BY_SLUG } from '@/lib/editions';
import { fetchStories } from '@/lib/api';

/**
 * The Wire — the default edition.
 *
 * Statically rendered and revalidated on an interval, so the document comes off
 * Vercel's edge with the stories already in it. This route used to accept
 * `searchParams`, which opts a route out of static rendering entirely: every
 * visitor triggered a serverless invocation that returned an empty shell, then
 * waited on a second round trip from the browser to the API before seeing a
 * headline. Nothing was cacheable and nothing was shared between visitors.
 *
 * Query params are still honoured — FeedPage reads them with
 * `useSearchParams()` inside the Suspense boundary below, which keeps the
 * dynamic part contained instead of making the whole page dynamic.
 */
export const revalidate = 60;

export default async function Home() {
  const edition = EDITIONS_BY_SLUG[''];
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
