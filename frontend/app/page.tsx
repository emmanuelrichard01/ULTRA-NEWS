import { Suspense } from 'react';

import FeedPage from '@/components/FeedPage';
import { EDITIONS_BY_SLUG } from '@/lib/editions';
import { fetchStories, fetchLeadStories, fetchMomentumStories } from '@/lib/api';

/**
 * The Wire — the default edition, and the product's front page.
 *
 * Statically rendered and revalidated on an interval, so the document comes off
 * Vercel's edge with the stories already in it. This route used to accept
 * `searchParams`, which opts a route out of static rendering entirely: every
 * visitor triggered a serverless invocation that returned an empty shell, then
 * waited on a second round trip from the browser to the API before seeing a
 * headline. Nothing was cacheable and nothing was shared between visitors.
 *
 * Three fetches rather than one, all resolved in parallel and all covered by
 * the same 60s revalidation, so the front page still arrives complete in a
 * single cached document:
 *
 *   feed      the chronological run
 *   lead      the newest INDEPENDENTLY CONFIRMED story, for the hero. Taking
 *             the hero off the top of the feed would hand it to whatever landed
 *             most recently, which on this corpus is almost always a single
 *             unconfirmed report.
 *   momentum  the sidebar ranking, from the momentum column rather than the
 *             velocity score that made the old panel render empty every time.
 *
 * Query params are still honoured — FeedPage reads them with
 * `useSearchParams()` inside the Suspense boundary below, which keeps the
 * dynamic part contained instead of making the whole page dynamic.
 */
export const revalidate = 60;

export default async function Home() {
  const edition = EDITIONS_BY_SLUG[''];

  const [initialStories, leadStories, momentumStories] = await Promise.all([
    fetchStories({ sort: edition.sort, minSources: edition.minSources }),
    fetchLeadStories({ limit: 5 }),
    fetchMomentumStories({ limit: 8 }),
  ]);

  return (
    <Suspense fallback={null}>
      <FeedPage
        edition={edition}
        initialStories={initialStories}
        leadStories={leadStories}
        momentumStories={momentumStories}
      />
    </Suspense>
  );
}
