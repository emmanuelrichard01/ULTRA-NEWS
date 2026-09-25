import Link from 'next/link';

import CorroborationMeter from './CorroborationMeter';
import NewsImage from './NewsImage';
import { corroborationScale, outletPhrase } from '@/lib/corroboration';
import { relativeTime } from '@/lib/time';
import { cleanExcerpt } from '@/lib/text';
import { CATEGORY_MAP, type StoryDetail } from '@/lib/types';
import { ArrowRight } from '@/components/icons';

/**
 * The editorial card set.
 *
 * Three shapes, each for one job, modelled on the portals in /inspo:
 *
 *   OverlayCard   headline set ON the photograph. For leads — the stories a
 *                 page is built around, where the image is the invitation.
 *   StoryTile     image above, text below. For grids of peers.
 *   RankedList    numbered text rows with an italic serif numeral. For
 *                 rankings, where the order is the information.
 *
 * Every one carries the corroboration count. On a photograph that is a frosted
 * badge rather than the coloured meter, because the meter's amber and teal are
 * unreadable over an arbitrary image — but it is the same count, in the same
 * words, so a reader never has to learn two vocabularies.
 */

// ==========================================================================
// Shared pieces
// ==========================================================================

function Time({ iso, prefix, className = '' }: { iso: string; prefix?: string; className?: string }) {
  const date = new Date(iso);
  return (
    <time
      dateTime={date.toISOString()}
      title={date.toLocaleString()}
      suppressHydrationWarning
      className={`font-data tabular-nums ${className}`}
    >
      {prefix ? `${prefix} ` : ''}
      {relativeTime(date)}
    </time>
  );
}

/** Corroboration for use over photography: frosted glass, white bars. */
export function OutletBadge({ outlets }: { outlets: number }) {
  const filled = outlets <= 0 ? 0 : Math.max(1, Math.round(corroborationScale(outlets) * 4));
  return (
    <span
      className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-white/20 bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md"
      title={outletPhrase(outlets)}
    >
      <span className="flex items-end gap-[2px]" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-[2.5px] rounded-[1px]"
            style={{
              height: `${5 + i * 2}px`,
              backgroundColor: i < filled ? '#fff' : 'rgb(255 255 255 / 0.3)',
            }}
          />
        ))}
      </span>
      <span className="font-data tabular-nums">{outletPhrase(outlets)}</span>
    </span>
  );
}

function outletLine(story: StoryDetail): string | null {
  const sources = story.sources ?? [];
  if (sources.length === 0) return null;
  const extra = Math.max(story.independent_count, sources.length) - 1;
  return extra > 0 ? `${sources[0]} + ${extra} more` : sources[0];
}

/**
 * Section header in the reference layouts' pattern: a small eyebrow, a large
 * serif title, and either a standfirst or a "see all" link on the right.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  href,
  linkLabel = 'See all',
  id,
  className = '',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  id?: string;
  className?: string;
}) {
  return (
    <header className={`mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h2 id={id} className="text-display-xl font-display text-balance text-[var(--foreground)]">
          {title}
        </h2>
      </div>
      {(description || href) && (
        <div className="flex max-w-sm shrink-0 flex-col gap-3 sm:items-end sm:text-right">
          {description && (
            <p className="text-body-sm text-[var(--foreground-muted)]">{description}</p>
          )}
          {href && (
            <Link
              href={href}
              className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--foreground)]"
            >
              {linkLabel}
              <ArrowRight className="nudge-arrow" />
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

// ==========================================================================
// OverlayCard
// ==========================================================================

/**
 * The no-photograph ground for an overlay card: ink, lit from one corner in
 * the corroboration teal. Many publisher feeds ship no image, and a flat grey
 * block under white type read as a broken load. This reads as a deliberate
 * typographic card.
 */
const OVERLAY_FALLBACK =
  'bg-[radial-gradient(120%_90%_at_0%_0%,color-mix(in_srgb,var(--verified-teal)_45%,#111214)_0%,#111214_60%)]';

// ==========================================================================
// OverlayCard (component)
// ==========================================================================

export function OverlayCard({
  story,
  size = 'tile',
  priority = false,
  timeField = 'first_seen_at',
  timePrefix,
  className = '',
}: {
  story: StoryDetail;
  size?: 'hero' | 'tile';
  priority?: boolean;
  timeField?: 'first_seen_at' | 'last_updated_at';
  timePrefix?: string;
  className?: string;
}) {
  const hero = size === 'hero';
  const category = story.categories?.[0];
  const summary = hero ? cleanExcerpt(story.summary, story.title) : '';
  const byline = outletLine(story);

  return (
    <article
      className={`group relative isolate overflow-hidden rounded-[var(--radius-card)] bg-[var(--inverse)] ${
        hero ? 'aspect-[4/5] sm:aspect-[16/10]' : 'aspect-[16/11] sm:aspect-[5/6]'
      } ${className}`}
    >
      <div className="media-frame absolute inset-0 !rounded-none">
        <NewsImage
          src={story.image_url}
          alt=""
          priority={priority}
          showFallbackText={false}
          fallbackClassName={OVERLAY_FALLBACK}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div className="media-scrim" aria-hidden="true" />

      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-4 sm:p-5">
        {category ? (
          <span className="rounded-[var(--radius-pill)] border border-white/20 bg-black/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-white/90 backdrop-blur-md">
            {CATEGORY_MAP[category]?.displayName ?? category}
          </span>
        ) : (
          <span />
        )}
        <OutletBadge outlets={story.independent_count} />
      </div>

      <div className={`absolute inset-x-0 bottom-0 z-10 ${hero ? 'p-5 sm:p-8' : 'p-4 sm:p-5'}`}>
        <h3
          className={`font-display text-balance text-white ${
            hero ? 'text-display-xl max-w-3xl' : 'text-[1.5rem] leading-[1.08] sm:text-[1.6rem]'
          }`}
        >
          <Link
            href={`/story/${story.slug}`}
            className="headline-link headline-link-inverse after:absolute after:inset-0 after:content-['']"
          >
            {story.title}
          </Link>
        </h3>
        {summary && (
          <p className="text-body-md mt-3 line-clamp-2 max-w-2xl text-white/80">{summary}</p>
        )}
        <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-white/70 ${hero ? 'mt-4 text-[13px]' : 'mt-2.5 text-[12px]'}`}>
          {byline && <span className="truncate">{byline}</span>}
          {byline && <span aria-hidden="true">·</span>}
          <Time
            iso={timeField === 'last_updated_at' ? story.last_updated_at : story.first_seen_at}
            prefix={timePrefix}
            className="text-[11px]"
          />
        </p>
      </div>
    </article>
  );
}

// ==========================================================================
// StoryTile
// ==========================================================================

export function StoryTile({
  story,
  priority = false,
  showExcerpt = true,
  aspect = 'aspect-[16/10]',
  className = '',
}: {
  story: StoryDetail;
  priority?: boolean;
  showExcerpt?: boolean;
  aspect?: string;
  className?: string;
}) {
  const summary = showExcerpt ? cleanExcerpt(story.summary, story.title) : '';
  const byline = outletLine(story);

  return (
    <article className={`group relative flex flex-col ${className}`}>
      <div className={`media-frame ${aspect}`}>
        <NewsImage
          src={story.image_url}
          alt=""
          priority={priority}
          fallbackSources={story.sources}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[var(--foreground-subtle)]">
        <CorroborationMeter outlets={story.independent_count} size="sm" />
        <span aria-hidden="true">·</span>
        <Time iso={story.first_seen_at} className="text-[11px]" />
      </div>
      <h3 className="text-display-sm font-display mt-2 text-balance text-[var(--foreground)]">
        <Link
          href={`/story/${story.slug}`}
          className="headline-link after:absolute after:inset-0 after:content-['']"
        >
          {story.title}
        </Link>
      </h3>
      {summary && (
        <p className="text-body-sm mt-2 line-clamp-2 text-[var(--foreground-muted)]">{summary}</p>
      )}
      {byline && (
        <p className="mt-2.5 truncate text-[12px] text-[var(--foreground-subtle)]">{byline}</p>
      )}
    </article>
  );
}

// ==========================================================================
// RankedList
// ==========================================================================

/**
 * Numbered rows, the "Most Read" pattern — here ranking what is being picked
 * up fastest. Each row states its gain in words as well as a split bar:
 * solid for outlets that joined inside the window, faint for those already
 * there. The bar is a second channel for the number, never the only one.
 */
export function RankedList({
  stories,
  metric = 'momentum',
  limit = 5,
}: {
  stories: StoryDetail[];
  metric?: 'momentum' | 'outlets';
  limit?: number;
}) {
  const rows = stories.slice(0, limit);

  return (
    <ol className="divide-y divide-[var(--border)]">
      {rows.map((story, i) => {
        const gained = story.recent_outlets ?? 0;
        const total = Math.max(story.independent_count, gained, 1);
        return (
          <li key={story.slug} className="group relative flex gap-4 py-4 first:pt-0 last:pb-0">
            <span className="rank-numeral w-9 shrink-0 pt-0.5" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-medium leading-snug tracking-[-0.01em] text-[var(--foreground)]">
                <Link
                  href={`/story/${story.slug}`}
                  className="headline-link after:absolute after:inset-0 after:content-['']"
                >
                  {story.title}
                </Link>
              </h3>
              {metric === 'momentum' && gained > 0 ? (
                <>
                  <div
                    className="mt-2.5 flex h-[3px] w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]"
                    aria-hidden="true"
                  >
                    <span className="h-full bg-[var(--accent)]" style={{ width: `${(gained / total) * 100}%` }} />
                    <span
                      className="h-full bg-[var(--accent)] opacity-25"
                      style={{ width: `${((total - gained) / total) * 100}%` }}
                    />
                  </div>
                  <p className="font-data mt-1.5 flex items-center gap-2 text-[11px] tabular-nums text-[var(--foreground-subtle)]">
                    <span className="font-semibold text-[var(--accent)]">+{gained} in 12h</span>
                    <span aria-hidden="true">·</span>
                    <span>{total} outlets total</span>
                  </p>
                </>
              ) : (
                <div className="font-data mt-1.5 flex items-center gap-2 text-[11px] text-[var(--foreground-subtle)]">
                  <CorroborationMeter outlets={story.independent_count} size="sm" />
                  <span aria-hidden="true">·</span>
                  <Time iso={story.first_seen_at} />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
