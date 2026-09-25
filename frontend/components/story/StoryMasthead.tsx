import Link from 'next/link';

import CorroborationMeter from '@/components/CorroborationMeter';
import CategoryPill from '@/components/CategoryPill';
import NewsImage from '@/components/NewsImage';
import VideoBadge from '@/components/VideoBadge';
import AskAboutStory from './AskAboutStory';
import { describeCorroboration } from '@/lib/corroboration';
import type { StoryDetailFull } from '@/lib/types';

/**
 * StoryMasthead — the verification verdict, above everything else.
 *
 * A reader arriving at a story is asking one question first: can I trust this
 * yet? So the corroboration state is stated in plain words at the top, before
 * the headline's supporting detail, rather than being encoded in a coloured pill
 * whose meaning has to be learned.
 *
 * The old header led with a "VERIFIED" badge — a verdict the reader had to take
 * on faith. This states the evidence instead: which outlets, how many, who was
 * first, how long ago.
 */

interface StoryMastheadProps {
  story: StoryDetailFull;
  outletNames: string[];
  brokenBy?: { name: string; at: string } | null;
  /** The first outlet photograph in the cluster, credited to that outlet. */
  image?: { url: string; credit: string } | null;
}

export default function StoryMasthead({ story, outletNames, brokenBy, image }: StoryMastheadProps) {
  const outlets = story.independent_count;
  const descriptor = describeCorroboration(outlets);
  const firstSeen = new Date(story.first_seen_at);
  // Counted in publishers, like corroboration: two BBC feeds are one outlet.
  const videoOutlets = new Set(
    story.articles.filter((a) => a.video_url).map((a) => a.source.publisher ?? a.source.name)
  ).size;

  return (
    <header className="border-b border-[var(--border)] pb-10">
      {/* Back link sits above everything — an escape hatch you find before you
          need it, not one buried under the article you're trying to leave. */}
      <nav aria-label="Breadcrumb" className="mb-8">
        <ol className="flex items-center gap-2 text-[13px] text-[var(--foreground-subtle)]">
          <li>
            <Link
              href="/"
              className="group inline-flex items-center gap-1.5 text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-300 group-hover:-translate-x-0.5">
                <path d="m15 18-6-6 6-6" />
              </svg>
              The Wire
            </Link>
          </li>
          {story.categories[0] && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href={`/${story.categories[0]}`}
                  className="capitalize text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  {story.categories[0]}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {story.categories.map((cat) => (
          <CategoryPill key={cat} label={cat} href={`/${cat}`} size="xs" />
        ))}
        <time
          dateTime={firstSeen.toISOString()}
          className="font-data text-[12px] text-[var(--foreground-subtle)]"
        >
          {firstSeen.toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })}
        </time>
      </div>

      <h1 className="text-display-2xl font-display animate-fade-in-up text-balance text-[var(--foreground)]">
        {story.title}
      </h1>

      {/*
        One verification statement, not a panel plus a stat grid saying the same
        thing twice. The meter carries the magnitude, the sentence carries the
        meaning, and the outlet names are the evidence — so there is nothing left
        for a separate "Outlets: 7" tile to add.
      */}
      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <CorroborationMeter outlets={outlets} size="lg" showLabel={false} className="shrink-0 pt-1" />

        <div className="min-w-0">
          <p className="text-body-lg text-[var(--foreground)]">
            {descriptor.description(outlets)}
          </p>

          {outletNames.length > 0 && (
            <p className="text-body-sm mt-1.5 text-[var(--foreground-muted)]">
              {outletNames.slice(0, 6).join(' · ')}
              {outletNames.length > 6 && ` and ${outletNames.length - 6} more`}
            </p>
          )}

          {/* Article count stated only when it differs from the outlet count,
              so "9 articles" can never be misread as 9 confirmations. */}
          <p className="font-data mt-3 text-[11px] text-[var(--foreground-subtle)]">
            {brokenBy && <>First reported by {brokenBy.name}</>}
            {brokenBy && story.source_count > outlets && ' · '}
            {story.source_count > outlets && (
              <>{story.source_count} articles in total</>
            )}
          </p>
          {videoOutlets > 0 && (
            <a href="#sources" className="mt-3 inline-flex transition-opacity hover:opacity-80">
              <VideoBadge outlets={videoOutlets} variant="count" />
            </a>
          )}
        </div>
      </div>
      <div className="mt-8">
        <AskAboutStory slug={story.slug} title={story.title} independentCount={story.independent_count} />
      </div>

      {image && (
        <figure className="mt-10">
          <div className="media-frame aspect-[16/9] w-full">
            <NewsImage
              src={image.url}
              alt=""
              priority
              showFallbackText={false}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <figcaption className="font-data mt-2.5 text-[11px] text-[var(--foreground-subtle)]">
            Image via {image.credit}. Ultra News links to reporting; it does not republish it.
          </figcaption>
        </figure>
      )}
    </header>
  );
}
