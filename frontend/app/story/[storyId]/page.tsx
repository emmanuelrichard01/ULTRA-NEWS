import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import StoryMasthead from '@/components/story/StoryMasthead';
import CorroborationTimeline from '@/components/story/CorroborationTimeline';
import CoverageCadence from '@/components/story/CoverageCadence';
import FramingMatrix from '@/components/story/FramingMatrix';
import SourceLedger from '@/components/story/SourceLedger';
import IntelligenceBrief from '@/components/IntelligenceBrief';
import StickyStoryNav from '@/components/StickyStoryNav';
import CorroborationMeter from '@/components/CorroborationMeter';
import { fetchStory, fetchRelatedStories, fetchStories } from '@/lib/api';
import type { StoryDetail } from '@/lib/types';

/**
 * Story page.
 *
 * Structured around the question a reader actually arrives with — "can I trust
 * this yet?" — answered with evidence rather than a badge:
 *
 *   1. Masthead   the verification statement, in plain words
 *   2. Brief      what the sources collectively say, and where they conflict
 *   3. Timeline   who broke it, who followed, how fast
 *   4. Framing    the same event as each newsroom chose to headline it
 *   5. Ledger     every article, grouped by outlet, linking out
 *   6. Related    semantically adjacent stories
 *
 * The previous page opened with a decorative parallax image and a step chart of
 * cumulative article count over time — analytical-looking, but answering no
 * question a reader has, and plotting articles rather than publishers so one
 * outlet filing three updates looked like three confirmations. Both are gone.
 */

interface StoryPageProps {
  params: Promise<{ storyId: string }>;
}

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const { storyId } = await params;
  const story = await fetchStory(storyId);
  if (!story) return { title: 'Story not found' };

  const outlets = story.independent_count;
  const description =
    story.summary ||
    `Covered by ${outlets} independent ${outlets === 1 ? 'outlet' : 'outlets'}.`;

  return {
    title: story.title,
    description,
    openGraph: {
      title: story.title,
      description,
      type: 'article',
      publishedTime: story.first_seen_at,
      modifiedTime: story.last_updated_at,
    },
    other: { 'article:section': story.categories?.[0] || 'News' },
  };
}

function RelatedStories({ stories }: { stories: StoryDetail[] }) {
  if (stories.length === 0) return null;

  return (
    <section aria-labelledby="related-heading" className="border-t border-[var(--border)] py-12">
      <h2 id="related-heading" className="text-display-md font-display mb-6 text-[var(--foreground)]">
        Related coverage
      </h2>
      <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {stories.map((story) => (
          <li key={story.slug} className="group relative">
            <div className="mb-2">
              <CorroborationMeter outlets={story.independent_count} size="sm" />
            </div>
            <h3 className="text-body-md font-display leading-snug text-[var(--foreground)]">
              <Link
                href={`/story/${story.slug}`}
                className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-[var(--accent)]"
              >
                {story.title}
              </Link>
            </h3>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Cacheable at the edge, purged precisely rather than on a timer.
 *
 * The page was rendered on demand for every visit. It does not need to be: the
 * backend already calls the revalidate webhook when a cluster actually changes,
 * and `fetchStory` tags its request `story:<slug>`, so `revalidateTag` drops
 * exactly this page the moment its corroboration count moves.
 *
 * The interval below is therefore a backstop for a missed webhook, not the
 * mechanism — which is why it can be generous without making anything stale.
 */
export const revalidate = 300;

/**
 * Prerender the stories the feeds actually link to.
 *
 * `revalidate` alone was not enough: a dynamic segment with no
 * `generateStaticParams` is rendered per request and never populates the
 * full-route cache, so every story page returned `X-Vercel-Cache: MISS`
 * however the fetches were configured.
 *
 * Building the front page's stories covers the overwhelming majority of real
 * traffic, since almost nobody arrives at a story except through a feed.
 * `dynamicParams` stays at its default, so anything not built here — an older
 * story, a shared link — still renders on demand and is cached from then on.
 *
 * Returning `[]` on failure is deliberate: a build must not depend on the API
 * being reachable. Worst case every page renders on demand, which is exactly
 * the behaviour this replaces.
 */
export async function generateStaticParams() {
  try {
    const [wire, record] = await Promise.all([
      fetchStories({ limit: 40 }),
      fetchStories({ limit: 20, sort: 'significance' }),
    ]);
    const slugs = new Set(
      [...wire.items, ...record.items].map((s) => s.slug).filter(Boolean)
    );
    return [...slugs].map((storyId) => ({ storyId }));
  } catch {
    return [];
  }
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { storyId } = await params;

  const [story, related] = await Promise.all([
    fetchStory(storyId),
    fetchRelatedStories(storyId),
  ]);

  if (!story) notFound();

  const articles = story.articles ?? [];
  const chronological = [...articles].sort(
    (a, b) => new Date(a.published_date).getTime() - new Date(b.published_date).getTime()
  );

  const outletNames = [...new Set(chronological.map((a) => a.source.name))];
  const first = chronological[0];
  const brokenBy = first ? { name: first.source.name, at: first.published_date } : null;

  return (
    <article className="mx-auto max-w-3xl">
      <StickyStoryNav
        title={story.title}
        sourceCount={story.independent_count}
        isVerified={story.independent_count >= 3}
        isDeveloping={story.independent_count === 2}
      />

      {/* schema.org NewsArticle. `sameAs` lists the corroborating reports, which
          is the machine-readable form of this page's whole argument. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: story.title,
            datePublished: story.first_seen_at,
            dateModified: story.last_updated_at,
            description: story.summary,
            articleSection: story.categories?.[0],
            sameAs: chronological.slice(0, 10).map((a) => a.url),
            publisher: {
              '@type': 'Organization',
              name: 'Ultra News',
              url: process.env.NEXT_PUBLIC_APP_URL || 'https://ultra-news.demo',
            },
          }),
        }}
      />

      <StoryMasthead story={story} outletNames={outletNames} brokenBy={brokenBy} />

      <IntelligenceBrief
        aiSummary={story.ai_summary}
        synthesisStatus={story.synthesis_status}
        sourceCount={story.source_count}
        independentCount={story.independent_count}
        fallbackSummary={story.summary}
      />

      <CorroborationTimeline articles={articles} />
      <CoverageCadence articles={articles} />
      <FramingMatrix articles={articles} />
      <SourceLedger articles={articles} />
      <RelatedStories stories={related} />
    </article>
  );
}
