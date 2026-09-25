import type { Metadata } from 'next';
import Link from 'next/link';

import CitedText from '@/components/CitedText';
import JsonLd, { breadcrumbList } from '@/components/JsonLd';
import CorroborationMeter from '@/components/CorroborationMeter';
import NewsImage from '@/components/NewsImage';
import ListenButton from '@/components/story/ListenButton';
import { RankedList } from '@/components/cards';
import { fetchBriefing } from '@/lib/api';
import { IS_INDEXABLE, absoluteUrl } from '@/lib/site';
import { relativeTime } from '@/lib/time';
import { CATEGORY_MAP, type BriefingItem, type StoryDetail } from '@/lib/types';
import { ArrowRight } from '@/components/icons';

/**
 * The Briefing — today's corroborated stories, in two minutes.
 *
 * The editions answer "what is there?"; this answers "what happened?". It is
 * built by the backend from stories at least two independent newsrooms have
 * filed on (core/services/briefing.py), so the most-skimmed page on the site
 * never leads with a single unconfirmed report. Every line cites its story.
 */

export const metadata: Metadata = {
  title: 'The Briefing',
  description:
    'Today’s stories confirmed by at least two independent newsrooms, summarised in two minutes — every line cited.',
  alternates: { canonical: '/briefing' },
};

export const revalidate = 300;

/** ~230 words a minute, rounded up, never under one. */
function readingMinutes(texts: string[]): number {
  const words = texts.join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 230));
}

function asStory(item: BriefingItem): StoryDetail {
  return {
    id: item.n,
    title: item.title,
    slug: item.slug,
    summary: item.summary,
    first_seen_at: item.first_seen_at,
    last_updated_at: item.last_updated_at,
    source_count: item.independent_count,
    independent_count: item.independent_count,
    velocity_score: 0,
    status: 'developing',
    image_url: item.image_url,
    categories: item.categories,
    sources: item.sources,
    recent_outlets: item.recent_outlets,
  };
}

export default async function BriefingPage() {
  const briefing = await fetchBriefing();

  if (!briefing || briefing.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <p className="eyebrow mb-4 justify-center">The Briefing</p>
        <h1 className="text-display-xl font-display text-[var(--foreground)]">Nothing confirmed yet today</h1>
        <p className="text-body-lg mx-auto mt-4 max-w-md text-[var(--foreground-muted)]">
          The Briefing only includes stories a second independent newsroom has
          filed on. None have reached that bar yet — check The Wire for
          everything as it lands.
        </p>
        <Link href="/" className="pill pill-solid group mt-8">
          Go to The Wire <ArrowRight className="nudge-arrow" />
        </Link>
      </div>
    );
  }

  const bySlugN = new Map(briefing.items.map((item) => [item.n, item]));
  const hrefFor = (n: number) => (bySlugN.has(n) ? `#b-${n}` : null);
  const titleFor = (n: number) => bySlugN.get(n)?.title;
  const strip = (t: string) => t.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '').replace(/\*\*/g, '');

  const generated = new Date(briefing.generated_at);
  const minutes = readingMinutes([briefing.overview, ...briefing.items.map((i) => i.line ?? '')]);
  const listenText = [
    `The Briefing. ${strip(briefing.overview)}`,
    ...briefing.items.map((i, idx) => `Story ${idx + 1}. ${i.title}. ${strip(i.line ?? '')}`),
  ].join(' ');
  const outlets = new Set(briefing.items.flatMap((i) => i.sources)).size;
  const [lead, ...rest] = briefing.items;

  /**
   * The Briefing as an ItemList of the stories it summarises, in rank order —
   * what the page is, stated for crawlers, with the date it describes.
   */
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': absoluteUrl('/briefing#page'),
        url: absoluteUrl('/briefing'),
        name: 'The Briefing — today, confirmed',
        description: strip(briefing.overview),
        dateModified: briefing.generated_at,
        isPartOf: { '@id': absoluteUrl('/#website') },
        mainEntity: {
          '@type': 'ItemList',
          itemListOrder: 'https://schema.org/ItemListOrderDescending',
          numberOfItems: briefing.items.length,
          itemListElement: briefing.items.map((item) => ({
            '@type': 'ListItem',
            position: item.n,
            url: absoluteUrl(`/story/${item.slug}`),
            name: item.title,
          })),
        },
      },
      breadcrumbList([
        ['The Wire', '/'],
        ['The Briefing', '/briefing'],
      ]),
    ],
  };

  return (
    <div className="mx-auto max-w-5xl">
      {IS_INDEXABLE && <JsonLd data={structuredData} />}
      {/* ------------------------------------------------------ masthead */}
      <header className="border-b border-[var(--border)] pb-10 text-center">
        <p className="eyebrow mb-5 justify-center">
          The Briefing ·{' '}
          <time dateTime={generated.toISOString()} suppressHydrationWarning>
            {generated.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </time>
        </p>
        <h1 className="text-display-3xl font-display animate-fade-in-up text-balance text-[var(--foreground)]">
          Today, <span className="italic text-[var(--foreground-muted)]">confirmed.</span>
        </h1>
        <p className="text-body-lg mx-auto mt-5 max-w-xl text-[var(--foreground-muted)]">
          {briefing.items.length} stories at least two independent newsrooms have
          filed on in the last {briefing.window_hours} hours. Every line links to
          the story behind it.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <ListenButton text={listenText} label="Listen to the briefing" />
          <span className="font-data text-[12px] text-[var(--foreground-subtle)]">
            {minutes} min read · {outlets} newsrooms
          </span>
        </div>
      </header>

      {/* ------------------------------------------------------ overview */}
      <section aria-label="Overview" className="mx-auto max-w-3xl border-b border-[var(--border)] py-12">
        <p className="font-display text-[clamp(1.5rem,2vw+0.9rem,2.1rem)] leading-[1.25] text-[var(--foreground)] first-letter:float-left first-letter:mr-3 first-letter:text-[4.2em] first-letter:leading-[0.8]">
          <CitedText text={briefing.overview} hrefFor={hrefFor} titleFor={titleFor} />
        </p>
        <p className="font-data mt-6 text-[11px] text-[var(--foreground-subtle)]">
          {briefing.synthesis_type === 'llm'
            ? `Written by ${briefing.model ?? 'a language model'} from the stories below. Not human-edited — check it against them.`
            : 'Assembled directly from the stories below — no model involved.'}{' '}
          Updated{' '}
          <span suppressHydrationWarning>{relativeTime(generated)}</span>.
        </p>
      </section>

      {/* ------------------------------------------------------ the stories */}
      <ol className="divide-y divide-[var(--border)]">
        {[lead, ...rest].map((item, idx) => (
          <li
            key={item.slug}
            id={`b-${item.n}`}
            className={`group relative grid scroll-mt-[calc(var(--header-h)+2rem)] gap-5 py-10 target:bg-[var(--accent)]/[0.04] sm:gap-8 ${
              idx === 0 ? 'md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]' : 'sm:grid-cols-[4rem_minmax(0,1fr)_12rem]'
            }`}
          >
            {idx !== 0 && (
              <span className="rank-numeral hidden !text-[2.6rem] sm:block" aria-hidden="true">
                {String(idx + 1).padStart(2, '0')}
              </span>
            )}

            {idx === 0 && (
              <div className="media-frame aspect-[16/10]">
                <NewsImage src={item.image_url} alt="" priority fallbackSources={item.sources} className="absolute inset-0 h-full w-full object-cover" />
              </div>
            )}

            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {idx === 0 && <span className="text-label text-[var(--wire-red)]">Lead</span>}
                {item.categories[0] && (
                  <span className="text-label text-[var(--foreground-subtle)]">
                    {CATEGORY_MAP[item.categories[0]]?.displayName ?? item.categories[0]}
                  </span>
                )}
                <CorroborationMeter outlets={item.independent_count} size="sm" />
              </div>
              <h2 className={`font-display text-balance text-[var(--foreground)] ${idx === 0 ? 'text-display-lg' : 'text-display-md'}`}>
                <Link href={`/story/${item.slug}`} className="headline-link after:absolute after:inset-0 after:content-['']">
                  {item.title}
                </Link>
              </h2>
              {item.line && (
                <p className="text-body-lg measure mt-3 text-[var(--foreground-muted)]">
                  <CitedText text={item.line} hrefFor={hrefFor} titleFor={titleFor} />
                </p>
              )}
              <p className="mt-3 truncate text-[12px] text-[var(--foreground-subtle)]">
                {item.sources.slice(0, 4).join(' · ')}
                {item.independent_count > 4 && ` · +${item.independent_count - 4} more`}
              </p>
            </div>

            {idx !== 0 && (
              <div className="media-frame hidden aspect-[4/3] self-start sm:block">
                <NewsImage src={item.image_url} alt="" fallbackSources={item.sources} showFallbackText={false} className="absolute inset-0 h-full w-full object-cover" />
              </div>
            )}
          </li>
        ))}
      </ol>

      {/* ------------------------------------------------------ watch list */}
      {briefing.watch.length > 0 && (
        <section aria-labelledby="watch-heading" className="mt-6 grid gap-8 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 sm:p-8 md:grid-cols-[16rem_minmax(0,1fr)]">
          <div>
            <p className="eyebrow mb-3">
              <span className="live-dot" aria-hidden="true" />
              What to watch
            </p>
            <h2 id="watch-heading" className="text-display-md font-display text-[var(--foreground)]">
              Gaining outlets right now
            </h2>
            <p className="text-body-sm mt-2 text-[var(--foreground-muted)]">
              Not yet in the briefing — ranked by independent newsrooms that
              joined in the last 12 hours.
            </p>
          </div>
          <RankedList stories={briefing.watch.map(asStory)} metric="momentum" limit={3} />
        </section>
      )}

      <p className="mx-auto mt-12 max-w-2xl text-center text-[13px] leading-relaxed text-[var(--foreground-subtle)]">
        The Briefing counts agreement, not truth: a story many outlets carry can
        still be wrong. It includes only stories at least two independent
        newsrooms have filed on, ordered by how many.{' '}
        <Link href="/about" className="underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--foreground)]">
          How it works
        </Link>
      </p>
    </div>
  );
}
