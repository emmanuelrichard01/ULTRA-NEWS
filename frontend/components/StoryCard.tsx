import Link from 'next/link';

import CorroborationMeter from './CorroborationMeter';
import CategoryPill from './CategoryPill';
import NewsImage from './NewsImage';
import SourceChain from './SourceChain';
import FramingCompare, { type Framing } from './FramingCompare';
import { relativeTime } from '@/lib/time';
import { cleanExcerpt } from '@/lib/text';

/**
 * StoryCard — the feed's primary unit.
 *
 * The corroboration meter leads the metadata line on every variant, and it is
 * the first thing in the row for a reason: the number of independent newsrooms
 * behind a story is the product's whole claim, so it is stated before the
 * headline rather than after it. Because it is always first, the meters line up
 * into a column down the feed and can be compared at a glance.
 *
 * Structural note: the card uses a "stretched link" — the whole surface is
 * clickable via an absolutely-positioned pseudo-element on the headline's <a>,
 * while controls sit as SIBLINGS lifted with z-10. Interactive content inside
 * an anchor is invalid HTML: it breaks keyboard navigation, confuses screen
 * readers, and forces `e.preventDefault()` calls throughout to stop the link
 * firing when a button is pressed.
 *
 * The `useState` this used to hold — tracking which framing was hovered, in
 * order to swap the headline — is gone with the switcher. FramingCompare owns
 * its own disclosure state, so the card itself is now stateless.
 */

export interface StoryCardProps {
  title: string;
  slug: string;
  imageUrl?: string | null;
  excerpt?: string;
  /**
   * The time to show. Which timestamp this is comes from the edition — see
   * `timeField` in lib/editions.ts. A chronological edition means "first
   * reported"; a momentum edition means "last outlet joined".
   */
  timestamp: string | Date;
  /** Prefix that says which of those two this is, e.g. "updated". */
  timestampPrefix?: string;
  /** Total articles in the cluster. */
  sourceCount: number;
  /** Distinct publishers — the number corroboration is measured in. */
  independentCount?: number;
  sources?: string[];
  categories?: string[];
  framingPreview?: Framing[];
  variant?: 'standard' | 'compact';
  /** Outlets gained inside the momentum window — Developing edition only. */
  recentOutlets?: number | null;
  /** Position in a ranked edition. Omitted in chronological ones. */
  rank?: number;
  /** Thumbnails are noise in a ranked list of fast-moving stories. */
  showImage?: boolean;
}

export default function StoryCard({
  title,
  slug,
  imageUrl,
  excerpt,
  timestamp,
  timestampPrefix,
  sourceCount,
  independentCount,
  sources = [],
  categories = [],
  framingPreview = [],
  variant = 'standard',
  recentOutlets = null,
  rank,
  showImage = true,
}: StoryCardProps) {
  const dateObj = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const outlets = independentCount ?? sources.length ?? 1;
  const href = `/story/${slug}`;

  const time = (
    <time
      dateTime={dateObj.toISOString()}
      title={dateObj.toLocaleString()}
      // The server renders this when the page is revalidated, the browser when
      // it hydrates, and those are different clocks — a story on the boundary
      // legitimately reads "59m ago" in the HTML and "1h ago" after hydration.
      // The `dateTime` attribute carries the exact instant either way, so the
      // difference is cosmetic and the warning is noise.
      suppressHydrationWarning
      className="font-data shrink-0 text-[11px] tabular-nums text-[var(--foreground-subtle)]"
    >
      {timestampPrefix ? `${timestampPrefix} ` : ''}
      {relativeTime(dateObj)}
    </time>
  );

  // Sources arrive oldest-first, so their order says who broke the story and
  // who followed. SourceChain renders that; a joined list threw it away.
  const attribution = (variant: 'lead' | 'inline') =>
    sources.length > 0 ? (
      <SourceChain
        sources={sources}
        independentCount={outlets}
        variant={variant}
      />
    ) : null;

  const summary = cleanExcerpt(excerpt, title);

  /**
   * Momentum badge — states the evidence, not a score.
   *
   * "+4 in 12h" is checkable. An abstract "velocity 3.7" was not, and the
   * sparkline that used to sit here had two of its three bars hardcoded.
   *
   * Phrased differently when every outlet arrived inside the window, because
   * "+16 in 12h" beside a meter reading "16 outlets" is the same number twice.
   * That a story went from nothing to sixteen newsrooms in half a day is the
   * more interesting fact anyway, so it says that instead.
   */
  const momentum =
    recentOutlets && recentOutlets > 0 ? (
      <span className="font-data inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-chip)] border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-2 py-[3px] text-[11px] text-[var(--accent)]">
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7 17 17 7M17 7H9M17 7v8" />
        </svg>
        {recentOutlets >= outlets
          ? 'all coverage in 12h'
          : `+${recentOutlets} in 12h`}
      </span>
    ) : null;

  // The 'lead' variant that used to live here — picture, then kicker, then
  // headline, then standfirst, stacked — is now LeadHero, which overlays the
  // same information onto the image and takes roughly half the height. See that
  // component for why.

  // ------------------------------------------------------------- compact
  if (variant === 'compact') {
    return (
      <article className="group relative border-b border-[var(--border)] py-3.5 last:border-0">
        <div className="mb-1.5 flex items-center gap-2.5">
          <CorroborationMeter outlets={outlets} size="sm" showLabel={false} />
          {time}
        </div>
        <h3 className="text-body-md font-display leading-snug text-[var(--foreground)]">
          <Link
            href={href}
            className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-[var(--accent)]"
          >
            {title}
          </Link>
        </h3>
      </article>
    );
  }

  // ------------------------------------------------------------ standard
  //
  // Headline sizing: this was `text-display-lg` — clamped up to 32px — which is
  // a *section heading* size applied to every row of a list. Combined with 28px
  // of vertical padding it put about three stories on a laptop screen, so
  // scanning a wire feed meant scrolling past two headlines at a time. At
  // display-md the same column fits roughly twice as many without the headline
  // ceasing to be the loudest thing in the row.
  return (
    <article className="group relative border-b border-[var(--border)] py-5">
      <div className="flex min-w-0 gap-4 sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {rank !== undefined && (
              <span
                className="font-data text-[11px] tabular-nums text-[var(--foreground-subtle)]"
                aria-hidden="true"
              >
                {String(rank).padStart(2, '0')}
              </span>
            )}
            <CorroborationMeter outlets={outlets} size="sm" />
            {momentum}
            {categories.slice(0, 1).map((cat) => (
              <CategoryPill key={cat} label={cat} size="xs" />
            ))}
            {time}
          </div>

          <h3 className="text-display-md text-balance font-display leading-[1.2] text-[var(--foreground)]">
            <Link
              href={href}
              className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-[var(--accent)]"
            >
              {title}
            </Link>
          </h3>

          {summary && (
            <p className="text-body-sm measure mt-2 line-clamp-2 text-[var(--foreground-muted)]">
              {summary}
            </p>
          )}

          <div className="mt-2.5 flex flex-col gap-1.5">
            {attribution('inline')}
            <FramingCompare framings={framingPreview} />
          </div>
        </div>

        {imageUrl && showImage && (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface-sunken)] sm:h-24 sm:w-32">
            <NewsImage
              src={imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        )}
      </div>

      {/* sourceCount is reported separately from the publisher count so "12
          articles from 5 outlets" never reads as 12 independent confirmations. */}
      {sourceCount > outlets && (
        <p className="sr-only">
          {sourceCount} articles from {outlets} independent outlets.
        </p>
      )}
    </article>
  );
}


