import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import StoryMasthead from '@/components/story/StoryMasthead';
import CorroborationTimeline from '@/components/story/CorroborationTimeline';
import CoverageCadence from '@/components/story/CoverageCadence';
import FramingMatrix from '@/components/story/FramingMatrix';
import SourceLedger from '@/components/story/SourceLedger';
import IntelligenceBrief from '@/components/IntelligenceBrief';
import StickyStoryNav from '@/components/StickyStoryNav';
import StoryRail, { type RailSection } from '@/components/story/StoryRail';
import { KeyFacts, StoryUnfolding } from '@/components/story/BriefSections';
import { groupByOutlet } from '@/lib/outlets';
import JsonLd, { breadcrumbList } from '@/components/JsonLd';
import { cleanExcerpt } from '@/lib/text';
import { StoryTile } from '@/components/cards';
import { fetchStory, fetchRelatedStories, fetchStories } from '@/lib/api';
import { IS_INDEXABLE, absoluteUrl } from '@/lib/site';
import { CATEGORY_MAP, type StoryDetail, type StoryDetailFull } from '@/lib/types';

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
  if (!story) return { title: 'Story not found', robots: { index: false } };

  const outlets = story.independent_count;
  const names = [...new Set((story.articles ?? []).map((a) => a.source.name))];
  const body = cleanExcerpt(story.ai_summary?.consensus_lead || story.summary || '', story.title);

  /**
   * The snippet leads with the evidence. A search result for a news event is
   * one of dozens saying the same thing; the only thing this page can add in
   * 160 characters is how many independent newsrooms stand behind it.
   */
  const evidence =
    outlets >= 2
      ? `Corroborated by ${outlets} independent outlets${names.length ? `, including ${names.slice(0, 2).join(' and ')}` : ''}.`
      : `Reported by ${names[0] ?? 'one outlet'}; not yet independently confirmed.`;
  const description = truncate(`${evidence} ${body}`.trim(), 160);
  const categories = story.categories ?? [];

  return {
    title: story.title,
    description,
    keywords: [...categories, ...names.slice(0, 6), 'corroborated news'],
    // Story pages are reachable with query strings and from several feeds;
    // without a canonical those variants compete with each other.
    alternates: { canonical: `/story/${storyId}` },
    openGraph: {
      title: story.title,
      description,
      type: 'article',
      url: absoluteUrl(`/story/${storyId}`),
      publishedTime: story.first_seen_at,
      modifiedTime: story.last_updated_at,
      section: categories[0] ? CATEGORY_MAP[categories[0]]?.displayName ?? categories[0] : 'News',
      tags: categories,
    },
    twitter: { card: 'summary_large_image', title: story.title, description },
  };
}

/** Cut at a word boundary with an ellipsis, never mid-word. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/\s+\S*$/, '').replace(/[,;:.]$/, '') + '…';
}

/**
 * Per-story structured data.
 *
 * Typed `CollectionPage`, not `NewsArticle`, and the distinction is the whole
 * product. Ultra News did not report any of this: a story here is a cluster of
 * other newsrooms' articles, shown as excerpts that link out. Marking it up as
 * an article we published would claim authorship of reporting we do not own —
 * the exact thing the footer promises we do not do — and would invite search
 * engines to surface our page instead of the newsroom's.
 *
 * `hasPart` names the real articles and their real publishers, which is both
 * accurate and the most useful thing a crawler can learn here.
 */
function storyStructuredData(story: StoryDetailFull, storyId: string) {
  const url = absoluteUrl(`/story/${storyId}`);
  const category = story.categories?.[0];
  const articles = (story.articles ?? []).slice(0, 20);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#page`,
        url,
        name: story.title,
        description: story.ai_summary?.consensus_lead || story.summary,
        datePublished: story.first_seen_at,
        dateModified: story.last_updated_at,
        inLanguage: 'en',
        isPartOf: { '@id': absoluteUrl('/#website') },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        about: (story.categories ?? []).map((c) => ({ '@type': 'Thing', name: CATEGORY_MAP[c]?.displayName ?? c })),
        // The page IS a list of other newsrooms' articles — ItemList states that
        // shape directly, in the order they published.
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: articles.length,
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          itemListElement: articles.map((article, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
              '@type': 'NewsArticle',
              headline: article.title,
              url: article.url,
              datePublished: article.published_date,
              publisher: { '@type': 'Organization', name: article.source.name },
            },
          })),
        },
      },
      {
        ...breadcrumbList([
          ['The Wire', '/'],
          ...(category ? ([[CATEGORY_MAP[category]?.displayName ?? category, `/${category}`]] as [string, string][]) : []),
          [story.title, `/story/${storyId}`],
        ]),
        '@id': `${url}#breadcrumb`,
      },
    ],
  };
}

function RelatedStories({ stories }: { stories: StoryDetail[] }) {
  if (stories.length === 0) return null;

  return (
    <section aria-labelledby="related-heading" className="border-t border-[var(--border)] py-12">
      <h2 id="related-heading" className="text-display-lg font-display mb-8 text-[var(--foreground)]">
        Related coverage
      </h2>
      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2">
        {stories.slice(0, 4).map((story) => (
          <StoryTile key={story.slug} story={story} showExcerpt={false} />
        ))}
      </div>
    </section>
  );
}

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
  const pictured = chronological.find((a) => a.image_url);
  const image = pictured?.image_url ? { url: pictured.image_url, credit: pictured.source.name } : null;

  const brief = story.ai_summary;
  const keyFacts = brief?.key_facts ?? [];
  const unfolding = brief?.timeline ?? [];
  const outletGroups = groupByOutlet(articles);

  /**
   * The contents, built from what this story actually has. A section that
   * will render nothing gets no entry — a table of contents linking to
   * nothing is worse than none.
   */
  const sections: RailSection[] = [
    { id: 'brief', label: brief?.synthesis_type === 'llm' ? 'What the sources say' : 'Lead reporting' },
    ...(keyFacts.length > 0 ? [{ id: 'facts', label: 'Key facts' }] : []),
    ...(unfolding.length >= 2 ? [{ id: 'unfolding', label: 'How it unfolded' }] : []),
    { id: 'corroboration', label: 'How it was corroborated' },
    ...(outletGroups.length >= 2 ? [{ id: 'cadence', label: 'Pickup pattern' }] : []),
    ...(outletGroups.length >= 2 ? [{ id: 'framing', label: 'How outlets framed it' }] : []),
    { id: 'sources', label: 'Every source' },
    ...(related.length > 0 ? [{ id: 'related', label: 'Related coverage' }] : []),
  ];

  /**
   * What "Listen" reads: the brief as printed, with its caveats. Discrepancies
   * are read out too — a listener cannot glance at the amber box.
   */
  const listenText = [
    story.title + '.',
    brief?.consensus_lead || story.summary || '',
    keyFacts.length > 0 ? 'Key facts. ' + keyFacts.map((f) => f.fact).join(' ') : '',
    brief?.discrepancies?.length ? 'Where outlets disagree. ' + brief.discrepancies.join(' ') : '',
    brief?.open_questions?.length ? 'Still unanswered. ' + brief.open_questions.join(' ') : '',
    `This story is covered by ${story.independent_count} independent ${story.independent_count === 1 ? 'outlet' : 'outlets'}.`,
  ]
    .filter(Boolean)
    .join(' ')
    // Citation markers read aloud as "open bracket one" otherwise.
    .replace(/\[\d+\]/g, '');

  return (
    <div className="mx-auto max-w-6xl">
      {IS_INDEXABLE && (
        <JsonLd data={storyStructuredData(story, storyId)} />
      )}
      {/*
        One structured-data graph, not two.

        A second inline block used to sit here declaring the page a NewsArticle
        published by Ultra News, with `ultra-news.demo` hardcoded as the
        publisher URL. Emitting both left the page describing itself two
        contradictory ways — an article we authored, and a collection of other
        newsrooms' articles — and a crawler resolving that conflict is doing so
        arbitrarily. See storyStructuredData above for why CollectionPage is
        the honest one.
      */}
      <StickyStoryNav title={story.title} sourceCount={story.independent_count} slug={story.slug} />

      {/*
        Two columns from lg: the reading column at a comfortable measure, and a
        sticky rail with the evidence at a glance, the actions and the
        contents. Below lg the rail's content is either inline (Listen, Ask) or
        not needed (a contents list for a single-column scroll).
      */}
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_17.5rem] xl:gap-16">
        <article className="min-w-0 max-w-3xl">
          <StoryMasthead story={story} outletNames={outletNames} brokenBy={brokenBy} image={image} />

          <div id="brief" className="scroll-mt-[calc(var(--header-h)+4rem)]">
            <IntelligenceBrief
              aiSummary={story.ai_summary}
              synthesisStatus={story.synthesis_status}
              sourceCount={story.source_count}
              independentCount={story.independent_count}
              fallbackSummary={story.summary}
              slug={story.slug}
              title={story.title}
              listenText={listenText}
            />
          </div>

          <KeyFacts facts={keyFacts} independentCount={story.independent_count} />
          <StoryUnfolding timeline={unfolding} />

          <div id="corroboration" className="scroll-mt-[calc(var(--header-h)+4rem)]">
            <CorroborationTimeline articles={articles} />
          </div>
          <div id="cadence" className="scroll-mt-[calc(var(--header-h)+4rem)]">
            <CoverageCadence articles={articles} />
          </div>
          <div id="framing" className="scroll-mt-[calc(var(--header-h)+4rem)]">
            <FramingMatrix articles={articles} />
          </div>
          <div id="sources" className="scroll-mt-[calc(var(--header-h)+4rem)]">
            <SourceLedger articles={articles} />
          </div>
          <div id="related" className="scroll-mt-[calc(var(--header-h)+4rem)]">
            <RelatedStories stories={related} />
          </div>
        </article>

        <aside className="hidden lg:block">
          {/* Offset clears the section bar AND the story bar that slides in
              beneath it once the masthead scrolls away (~3rem). */}
          <div className="scroll-slim sticky top-[calc(var(--header-h)+4.25rem)] max-h-[calc(100vh-var(--header-h)-6rem)] overflow-y-auto pb-8">
            <StoryRail
              slug={story.slug}
              title={story.title}
              independentCount={story.independent_count}
              articleCount={story.source_count}
              firstSeenAt={story.first_seen_at}
              lastUpdatedAt={story.last_updated_at}
              brokenBy={brokenBy?.name}
              sections={sections}
              listenText={listenText}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
