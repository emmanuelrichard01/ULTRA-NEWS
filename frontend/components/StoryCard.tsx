"use client";

import Link from 'next/link';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import CorroborationMeter from './CorroborationMeter';
import CategoryPill from './CategoryPill';
import NewsImage from './NewsImage';
import FramingSwitcher, { type Framing } from './FramingSwitcher';

/**
 * StoryCard — the feed's primary unit.
 *
 * Structural note: the card uses a "stretched link" — the whole surface is
 * clickable via an absolutely-positioned pseudo-element on the headline's <a>,
 * while controls sit as SIBLINGS lifted with z-10. The previous version wrapped
 * everything, buttons included, inside one <a>. Interactive content inside an
 * anchor is invalid HTML: it breaks keyboard navigation, confuses screen
 * readers, and forced `e.preventDefault()` calls throughout to stop the link
 * from firing when a button was pressed.
 *
 * Also gone: a "velocity sparkline" whose first two bars were hardcoded to 40%
 * and 70%. Inventing a data visualisation is a strange thing to do anywhere; on
 * a product whose whole claim is verification it undermines the premise.
 */

interface StoryCardProps {
  title: string;
  slug: string;
  imageUrl?: string | null;
  excerpt?: string;
  publishedDate: string | Date;
  /** Total articles in the cluster. */
  sourceCount: number;
  /** Distinct publishers — the number corroboration is measured in. */
  independentCount?: number;
  sources?: string[];
  categories?: string[];
  framingPreview?: Framing[];
  variant?: 'lead' | 'standard' | 'compact';
  priority?: boolean;
  /** Outlets gained inside the momentum window — Developing edition only. */
  recentOutlets?: number | null;
  /** Position in a ranked edition. Omitted in chronological ones. */
  rank?: number;
}

export default function StoryCard({
  title,
  slug,
  imageUrl,
  excerpt,
  publishedDate,
  sourceCount,
  independentCount,
  sources = [],
  categories = [],
  framingPreview = [],
  variant = 'standard',
  priority = false,
  recentOutlets = null,
  rank,
}: StoryCardProps) {
  const dateObj = typeof publishedDate === 'string' ? new Date(publishedDate) : publishedDate;
  const outlets = independentCount ?? sources.length ?? 1;

  const [framedTitle, setFramedTitle] = useState<string | null>(null);

  const href = `/story/${slug}`;

  const timestamp = (
    <time
      dateTime={dateObj.toISOString()}
      className="font-data text-[11px] text-[var(--foreground-subtle)] tabular-nums"
    >
      {formatDistanceToNow(dateObj, { addSuffix: true })}
    </time>
  );

  // Deliberately does NOT change on hover. It shares a justify-between row with
  // the framing switcher, so swapping in "as headlined by X" resized it and slid
  // the buttons sideways under the pointer — the same feedback loop the headline
  // had, in the other axis. The active outlet is already indicated by its button.
  const attribution =
    sources.length > 0 ? (
      <span className="font-data truncate text-[11px] text-[var(--foreground-muted)]">
        {sources.slice(0, 3).join(' · ')}
        {sources.length > 3 && ` +${sources.length - 3}`}
      </span>
    ) : null;

  const handleFraming = (t: string | null) => {
    setFramedTitle(t);
  };

  /**
   * Momentum badge — states the evidence, not a score.
   *
   * "4 new outlets · 12h" is checkable. An abstract "velocity 3.7" was not, and
   * the sparkline that used to sit here had two of its three bars hardcoded.
   */
  const momentum =
    recentOutlets && recentOutlets > 0 ? (
      <span className="font-data inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-2 py-[3px] text-[11px] text-[var(--accent)]">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 17 17 7M17 7H9M17 7v8" />
        </svg>
        {recentOutlets} new {recentOutlets === 1 ? 'outlet' : 'outlets'} · 12h
      </span>
    ) : null;

  /**
   * Headline that cannot change height when the framing switches.
   *
   * Every candidate headline is rendered stacked in one grid cell; only the
   * active one is visible. The cell sizes to the TALLEST variant, so swapping
   * between them shifts nothing.
   *
   * Without this the card reflowed on every hover: a longer headline pushed the
   * framing buttons down, the pointer landed on a different button, that
   * selected a different headline, and the text flickered back and forth in a
   * feedback loop the reader could not escape.
   */
  const headline = (className: string) => {
    const variants = [title, ...framingPreview.map((f) => f.title)];
    const activeIndex = framedTitle ? variants.indexOf(framedTitle) : 0;

    return (
      <span className="grid">
        {variants.map((text, i) => (
          <span
            key={i}
            aria-hidden={i === activeIndex ? undefined : true}
            className={`col-start-1 row-start-1 ${className} ${
              i === activeIndex ? '' : 'invisible'
            }`}
          >
            {text}
          </span>
        ))}
      </span>
    );
  };

  // ---------------------------------------------------------------- lead
  if (variant === 'lead') {
    return (
      <article className="group relative">
        <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface-sunken)]">
          <NewsImage
            src={imageUrl}
            alt=""
            priority={priority}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
          />
        </div>

        <div className="pt-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
            <CorroborationMeter outlets={outlets} size="md" />
            {momentum}
            {categories.slice(0, 2).map((cat) => (
              <CategoryPill key={cat} label={cat} size="xs" />
            ))}
            {timestamp}
          </div>

          <h2 className="text-display-xl font-display text-[var(--foreground)] mb-3 text-balance">
            <Link
              href={href}
              className="after:absolute after:inset-0 after:content-[''] hover:text-[var(--accent)] transition-colors"
            >
              {headline('text-balance')}
            </Link>
          </h2>

          {excerpt && (
            <p className="text-body-lg text-[var(--foreground-muted)] measure mb-4">
              {excerpt}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            {attribution}
            <FramingSwitcher
              baseTitle={title}
              framings={framingPreview}
              onActiveChange={handleFraming}
              size="md"
            />
          </div>
        </div>
      </article>
    );
  }

  // ------------------------------------------------------------- compact
  if (variant === 'compact') {
    return (
      <article className="group relative py-4 border-b border-[var(--border)] last:border-0">
        <div className="flex items-start gap-3">
          <CorroborationMeter outlets={outlets} size="sm" showLabel={false} className="mt-1 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-display-sm font-display text-[var(--foreground)] leading-snug">
              <Link
                href={href}
                className="after:absolute after:inset-0 after:content-[''] hover:text-[var(--accent)] transition-colors"
              >
                {title}
              </Link>
            </h3>
            <div className="mt-1.5 flex items-center gap-2">
              {timestamp}
              {attribution}
            </div>
          </div>
        </div>
      </article>
    );
  }

  // ------------------------------------------------------------ standard
  return (
    <article className="group relative py-7 border-b border-[var(--border)]">
      <div className="flex gap-5 sm:gap-7">
        {rank !== undefined && (
          <span
            className="font-data hidden w-6 shrink-0 pt-1 text-right text-[13px] tabular-nums text-[var(--foreground-subtle)] sm:block"
            aria-hidden="true"
          >
            {rank}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2.5">
            <CorroborationMeter outlets={outlets} size="sm" />
            {momentum}
            {categories.slice(0, 1).map((cat) => (
              <CategoryPill key={cat} label={cat} size="xs" />
            ))}
            {timestamp}
          </div>

          <h3 className="text-display-lg font-display text-[var(--foreground)] leading-[1.15] text-balance">
            <Link
              href={href}
              className="after:absolute after:inset-0 after:content-[''] hover:text-[var(--accent)] transition-colors"
            >
              {headline('text-balance')}
            </Link>
          </h3>

          {excerpt && (
            <p className="text-body-md text-[var(--foreground-muted)] mt-2.5 line-clamp-2 measure">
              {excerpt}
            </p>
          )}

          <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            {attribution}
            <FramingSwitcher
              baseTitle={title}
              framings={framingPreview}
              onActiveChange={handleFraming}
            />
          </div>
        </div>

        {imageUrl && (
          <div className="relative shrink-0 w-24 h-24 sm:w-40 sm:h-28 overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface-sunken)]">
            <NewsImage
              src={imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
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
