import Link from 'next/link';

import { OverlayCard, RankedList, SectionHeader } from './cards';
import CorroborationMeter from './CorroborationMeter';
import LiveTicker from './LiveTicker';
import NewsImage from './NewsImage';
import TopicBrowser from './TopicBrowser';
import UnconfirmedPanel from './UnconfirmedPanel';
import { relativeTime } from '@/lib/time';
import type { StoryDetail } from '@/lib/types';
import { ArrowRight } from '@/components/icons';

/**
 * The front page's editorial half — everything above the chronological feed.
 *
 * The Wire used to open on its own feed header, a filter row and a carousel:
 * three bands of controls before a photograph. The portals in /inspo open on
 * the news. So the order here is:
 *
 *   1. Ticker        a single line of what is moving, with outlet counts
 *   2. Lead bento    the newest CONFIRMED story large, three more confirmed
 *                    beneath it, and the fastest-spreading stories ranked
 *                    beside them. Every photograph on this block is of a
 *                    story at least two newsrooms stand behind — the loudest
 *                    slot on the page goes to the strongest evidence.
 *   3. The gap       confirmed and not-yet-confirmed side by side. This pairing
 *                    is the product's argument; it survives the redesign
 *                    intact, just given room to be read.
 *   4. Topics        a browser over every beat.
 *
 * The feed follows, under its own section header, with the filters that act
 * on it — filters belong beside the list they filter, not above the hero.
 */
export default function FrontPage({
  leads,
  momentum,
  feed,
  initialTopic,
  initialTopicStories,
}: {
  leads: StoryDetail[];
  momentum: StoryDetail[];
  feed: StoryDetail[];
  initialTopic: string;
  initialTopicStories: StoryDetail[];
}) {
  const [hero, ...rest] = leads;
  const tiles = rest.slice(0, 3);
  const shownSlugs = new Set([hero, ...tiles].filter(Boolean).map((s) => s.slug));

  const moving = momentum.filter((s) => (s.recent_outlets ?? 0) >= 2);

  // Confirmed stories not already pictured above. The leads query returns
  // spares beyond the four the bento shows, and they are exactly this list's
  // subject — the feed's own first page is mostly single-source, so on a quiet
  // hour it alone can leave this column empty.
  const seen = new Set(shownSlugs);
  const confirmed = [...leads, ...feed]
    .filter((s) => {
      if (s.independent_count < 2 || seen.has(s.slug)) return false;
      seen.add(s.slug);
      return true;
    })
    .slice(0, 5);
  const unconfirmed = feed.filter((s) => s.independent_count <= 1);

  return (
    <div className="space-y-16 sm:space-y-20">
      <div>
        <LiveTicker stories={[...leads, ...moving, ...confirmed]} />

        {hero && (
          <section aria-label="Lead stories" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] xl:gap-10">
            <div className="min-w-0 space-y-4">
              <div className="animate-fade-in-up">
                <OverlayCard story={hero} size="hero" priority />
              </div>
              {tiles.length > 0 && (
                <div className="stagger grid gap-4 sm:grid-cols-3">
                  {tiles.map((story) => (
                    <OverlayCard key={story.slug} story={story} />
                  ))}
                </div>
              )}
            </div>

            <aside
              aria-labelledby="moving-heading"
              className="flex flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5 lg:self-start"
            >
              <div className="mb-5 flex items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
                <h2 id="moving-heading" className="font-display text-[28px] leading-none text-[var(--foreground)]">
                  Moving fastest
                </h2>
                <Link
                  href="/developing"
                  className="flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)] transition-colors hover:border-[var(--foreground)]"
                >
                  <span className="live-dot" aria-hidden="true" />
                  Live
                </Link>
              </div>

              {moving.length > 0 ? (
                <RankedList stories={moving} metric="momentum" limit={5} />
              ) : (
                <p className="text-body-sm text-[var(--foreground-subtle)]">
                  Nothing is accelerating right now. Stories appear here when fresh
                  outlets pick them up.
                </p>
              )}

              <p className="mt-5 border-t border-[var(--border)] pt-4 text-[12px] leading-snug text-[var(--foreground-subtle)]">
                Independent outlets that joined each story in the last 12 hours.
              </p>
              <Link
                href="/developing"
                className="group mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--foreground)]"
              >
                All developing stories
                <ArrowRight className="nudge-arrow" />
              </Link>
            </aside>
          </section>
        )}
      </div>

      {(confirmed.length > 0 || unconfirmed.length >= 3) && (
        <section aria-labelledby="gap-heading" className="reveal border-t border-[var(--border)] pt-12">
          <SectionHeader
            id="gap-heading"
            title="Confirmed, and not yet"
            description="The same hour of reporting, split by the only question this product exists to answer: has a second newsroom stood it up?"
          />
          <div className="grid gap-10 md:grid-cols-2 md:gap-12">
            {confirmed.length > 0 && (
              <div>
                <h3 className="mb-1 flex items-center gap-2 text-[13px] font-medium text-[var(--verified-teal)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--verified-teal)]" aria-hidden="true" />
                  Independently confirmed
                </h3>
                <p className="text-body-sm mb-4 text-[var(--foreground-subtle)]">
                  Most recent stories at least two newsrooms have filed on.
                </p>
                <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                  {confirmed.map((story) => (
                    <li key={story.slug} className="group relative flex gap-4 py-4">
                      <div className="media-frame h-[68px] w-[92px] shrink-0">
                        <NewsImage
                          src={story.image_url}
                          alt=""
                          showFallbackText={false}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[15px] font-medium leading-snug tracking-[-0.01em] text-[var(--foreground)]">
                          <Link
                            href={`/story/${story.slug}`}
                            className="headline-link after:absolute after:inset-0 after:content-['']"
                          >
                            {story.title}
                          </Link>
                        </h4>
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--foreground-subtle)]">
                          <CorroborationMeter outlets={story.independent_count} size="sm" />
                          <span aria-hidden="true">·</span>
                          <time className="font-data" dateTime={story.first_seen_at} suppressHydrationWarning>
                            {relativeTime(new Date(story.first_seen_at))}
                          </time>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {unconfirmed.length >= 3 && <UnconfirmedPanel stories={unconfirmed} />}
          </div>
        </section>
      )}

      <TopicBrowser initialTopic={initialTopic} initialStories={initialTopicStories} />
    </div>
  );
}
