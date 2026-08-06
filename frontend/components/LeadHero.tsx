import Link from 'next/link';

import NewsImage from './NewsImage';
import { describeCorroboration, outletPhrase } from '@/lib/corroboration';
import { cleanExcerpt } from '@/lib/text';
import { CATEGORY_MAP } from '@/lib/types';

/**
 * LeadHero — the front page lead, as one block.
 *
 * The lead used to be a stacked card: picture, then kicker, then headline, then
 * standfirst, then provenance. Every one of those is worth having and stacking
 * them cost the whole viewport — a 2:1 crop across the column plus four text
 * blocks under it meant the lead story alone filled the screen, and the feed it
 * was supposed to introduce started below the fold. Making the picture smaller
 * fixed the height and made the lead stop reading as a lead.
 *
 * Overlaying the text onto the image is the resolution: the same information in
 * roughly half the height, and it looks like a front page rather than like a
 * blog post with a header image.
 *
 * Contrast is handled deliberately, because text on photographs is where this
 * pattern usually fails. The scrim is a two-stop gradient that reaches near
 * opaque at the bottom where the type sits, and the type is white in BOTH
 * themes rather than following the theme token — the background here is a
 * photograph, not the page, so a light-theme dark-ink headline would be
 * illegible over half the images the wire produces.
 *
 * When there is no usable image the whole thing falls back to a solid surface
 * panel with the same geometry, using theme colours: the layout does not depend
 * on a publisher CDN having cooperated.
 */

interface LeadHeroProps {
  title: string;
  slug: string;
  imageUrl?: string | null;
  excerpt?: string;
  timestamp: string | Date;
  timestampPrefix?: string;
  independentCount: number;
  sources?: string[];
  categories?: string[];
  priority?: boolean;
  /** Relative-time formatter, shared with StoryCard. */
  formatTime: (d: Date) => string;
  /**
   * How much width this hero has.
   *
   * The crop has to follow the CONTAINER, not the viewport. The Wire runs its
   * lead in a ~500px column beside two panels; The Record runs one full-width
   * column. A ratio chosen for the first is a wall in the second — 3:2 across
   * 1024px is a 683px photograph, which is the exact problem the overlay was
   * built to solve, reintroduced one breakpoint over.
   */
  layout?: 'column' | 'wide';
}

const ASPECT = {
  column: 'aspect-[4/3] sm:aspect-[16/9] xl:aspect-[3/2]',
  wide: 'aspect-[16/9] sm:aspect-[21/9]',
} as const;

export default function LeadHero({
  title,
  slug,
  imageUrl,
  excerpt,
  timestamp,
  timestampPrefix,
  independentCount,
  sources = [],
  categories = [],
  priority = false,
  formatTime,
  layout = 'column',
}: LeadHeroProps) {
  const dateObj = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const descriptor = describeCorroboration(independentCount);
  const hasImage = Boolean(imageUrl);
  const summary = cleanExcerpt(excerpt, title);

  return (
    <article className="group relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface-sunken)]">
      <div className={`relative w-full ${ASPECT[layout]}`}>
        {hasImage && (
          <NewsImage
            src={imageUrl}
            alt=""
            priority={priority}
            // No typographic fallback: the overlay below already carries the
            // headline and the outlets, and a centred "Reported by…" behind it
            // collided with them whenever a publisher image failed.
            showFallbackText={false}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.03]"
          />
        )}

        {/*
          The scrim. Two stops rather than one: a gentle wash across the whole
          frame so the top-row chips hold up over a bright sky, and a much
          heavier foot where the headline sits.
        */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: hasImage
              ? 'linear-gradient(to top, rgb(8 10 14 / 0.92) 0%, rgb(8 10 14 / 0.75) 28%, rgb(8 10 14 / 0.25) 58%, rgb(8 10 14 / 0.35) 100%)'
              : 'linear-gradient(to top, rgb(8 10 14 / 0.92) 0%, rgb(8 10 14 / 0.8) 100%)',
          }}
        />

        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            {/*
              The meter, drawn for a photographic background.

              CorroborationMeter renders in theme tokens, which are tuned for
              paper and would disappear here. Same shape, same log-scaled fill,
              same vocabulary from lib/corroboration — recoloured for the one
              place in the product whose background is an image.
            */}
            <span
              className="inline-flex items-center gap-2 rounded-[var(--radius-chip)] bg-black/35 px-2 py-1 backdrop-blur-sm"
              title={descriptor.description(independentCount)}
            >
              <span className="flex items-end gap-[2px]" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    className="w-[3px] rounded-[1px] bg-white"
                    style={{
                      height: `${7 + i * 1.5}px`,
                      opacity: i < Math.min(independentCount, 6) ? 1 : 0.3,
                    }}
                  />
                ))}
              </span>
              <span className="font-data text-[12px] font-semibold text-white">
                {outletPhrase(independentCount)}
              </span>
            </span>

            {/*
              Not CategoryPill. That component draws itself in theme tokens —
              a --border hairline and --foreground-muted text — which are tuned
              for paper and vanish against a photograph; on the scrim it
              rendered as an empty dark rectangle. Same shape and typography,
              recoloured for this one context.
            */}
            {categories.slice(0, 1).map((cat) => (
              <span
                key={cat}
                className="font-data rounded-[var(--radius-chip)] bg-black/35 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.07em] text-white/85 backdrop-blur-sm"
              >
                {CATEGORY_MAP[cat]?.displayName ?? cat}
              </span>
            ))}

            <time
              dateTime={dateObj.toISOString()}
              suppressHydrationWarning
              className="font-data rounded-[var(--radius-chip)] bg-black/35 px-2 py-1 text-[11px] tabular-nums text-white/80 backdrop-blur-sm"
            >
              {timestampPrefix ? `${timestampPrefix} ` : ''}
              {formatTime(dateObj)}
            </time>
          </div>

          <h2 className="text-display-lg text-balance font-display text-white drop-shadow-sm">
            <Link
              href={`/story/${slug}`}
              className="transition-opacity after:absolute after:inset-0 after:content-[''] hover:opacity-90"
            >
              {title}
            </Link>
          </h2>

          {summary && (
            <p className="text-body-sm measure mt-2 line-clamp-2 text-white/75">
              {summary}
            </p>
          )}

          {sources.length > 0 && (
            <p className="font-data mt-3 truncate text-[11px] text-white/70">
              <span className="text-white/90">{sources[0]}</span>
              {independentCount > 1
                ? ` broke it · ${independentCount - 1} ${
                    independentCount - 1 === 1 ? 'outlet' : 'outlets'
                  } followed`
                : ' · sole source'}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
