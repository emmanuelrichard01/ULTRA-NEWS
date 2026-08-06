"use client";

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import LeadHero from './LeadHero';
import { relativeTime } from '@/lib/time';
import type { StoryDetail } from '@/lib/types';

/**
 * LeadCarousel — the front page's lead slot.
 *
 * The Wire is ordered by recency, and its most recent row is usually a single
 * newsroom's unconfirmed report; leading with it spends the loudest promise the
 * page can make on the weakest evidence it has. So the slot is filled by a
 * separate query for the most recent INDEPENDENTLY CONFIRMED stories, and shows
 * several of them rather than one, because on a wire there is rarely a single
 * obvious lead — there are four or five stories that matter, and picking one
 * arbitrarily is a judgement the data does not support.
 *
 * Rotation rules, in order of who wins:
 *
 *   1. `prefers-reduced-motion` — no autoplay at all. A carousel that moves on
 *      its own is exactly the pattern that setting exists to stop.
 *   2. The reader. Any interaction — arrows, dots, keyboard, a pointer resting
 *      on the panel, focus landing inside it — stops the rotation permanently
 *      for the session. Nothing is more hostile than a headline sliding away
 *      mid-sentence, and "pause on hover, resume on leave" still does that to
 *      anyone reading without a pointer on the element.
 *   3. Otherwise it advances slowly, and stops for good after one full pass, so
 *      a page left open does not animate indefinitely.
 *
 * Slides are all rendered and toggled with `hidden` rather than mounted on
 * demand, so the images of the next slides are already fetched when the reader
 * gets to them and the panel does not resize as it moves.
 */

const ADVANCE_MS = 7000;

interface LeadCarouselProps {
  stories: StoryDetail[];
  kicker?: string;
  /** Which clock this edition wants the reader watching. */
  timeField?: 'first_seen_at' | 'last_updated_at';
  timePrefix?: string;
  /** Passed through to LeadHero so the crop follows the container width. */
  layout?: 'column' | 'wide';
}

export default function LeadCarousel({
  stories,
  kicker,
  timeField = 'first_seen_at',
  timePrefix,
  layout = 'column',
}: LeadCarouselProps) {
  const [index, setIndex] = useState(0);
  const [isRotating, setIsRotating] = useState(true);
  const panelId = useId();
  const passesRef = useRef(0);

  const count = stories.length;

  const stop = useCallback(() => setIsRotating(false), []);

  const goTo = useCallback(
    (next: number) => {
      setIndex(((next % count) + count) % count);
      stop();
    },
    [count, stop]
  );

  // Autoplay. Disabled outright under reduced motion, and retired after one
  // full pass so a tab left open overnight is not still animating.
  useEffect(() => {
    if (!isRotating || count < 2) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const id = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % count;
        if (next === 0) {
          passesRef.current += 1;
          if (passesRef.current >= 1) setIsRotating(false);
        }
        return next;
      });
    }, ADVANCE_MS);

    return () => clearInterval(id);
  }, [isRotating, count]);

  if (count === 0) return null;

  const hero = (story: StoryDetail, isFirst: boolean) => (
    <LeadHero
      title={story.title}
      slug={story.slug}
      imageUrl={story.image_url}
      excerpt={story.summary}
      timestamp={
        timeField === 'last_updated_at' ? story.last_updated_at : story.first_seen_at
      }
      timestampPrefix={timePrefix}
      independentCount={story.independent_count}
      sources={story.sources}
      categories={story.categories}
      priority={isFirst}
      formatTime={relativeTime}
      layout={layout}
    />
  );

  // A single confirmed story needs no controls — a carousel of one is a card.
  if (count === 1) {
    return (
      <section aria-label="Lead story">
        {kicker && <Kicker text={kicker} />}
        {hero(stories[0], true)}
      </section>
    );
  }

  // No bottom margin of its own. The lead block's wrapper in FeedPage supplies
  // the spacing and the rule beneath; carrying a second `mb-8` here left the
  // carousel's box ending 32px above the companion panel beside it, so two
  // elements meant to read as one band finished at different heights.
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Lead stories"
      onMouseEnter={stop}
      onFocusCapture={stop}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        {kicker ? <Kicker text={kicker} inline /> : <span />}

        <div className="flex shrink-0 items-center gap-3">
          {/* Position, in words as well as dots — the dots alone do not say
              which of them is current to anyone not looking at them. */}
          <span className="font-data text-[11px] tabular-nums text-[var(--foreground-subtle)]">
            {index + 1} / {count}
          </span>

          <div className="flex items-center gap-1">
            <ArrowButton
              label="Previous story"
              onClick={() => goTo(index - 1)}
              controls={panelId}
              direction="prev"
            />
            <ArrowButton
              label="Next story"
              onClick={() => goTo(index + 1)}
              controls={panelId}
              direction="next"
            />
          </div>
        </div>
      </div>

      <div id={panelId} aria-live="polite">
        {stories.map((story, i) => (
          <div
            key={story.slug}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            hidden={i !== index}
          >
            {hero(story, i === 0)}
          </div>
        ))}
      </div>

      {/* Progress rules rather than dots. They sit on the same hairline
          vocabulary as the rest of the page, and a wide target is easier to hit
          than a 8px circle. */}
      <div className="mt-6 flex gap-1.5" role="tablist" aria-label="Choose a lead story">
        {stories.map((story, i) => (
          <button
            key={story.slug}
            role="tab"
            aria-selected={i === index}
            aria-controls={panelId}
            aria-label={story.title}
            onClick={() => goTo(i)}
            className="group/dot h-6 flex-1 py-2.5"
          >
            <span
              className={`block h-[2px] w-full rounded-full transition-colors duration-300 ${
                i === index
                  ? 'bg-[var(--foreground)]'
                  : 'bg-[var(--border)] group-hover/dot:bg-[var(--border-hover)]'
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}

function Kicker({ text, inline = false }: { text: string; inline?: boolean }) {
  return (
    <p
      className={`text-label text-[var(--foreground-subtle)] ${
        inline ? 'section-rule min-w-0 flex-1' : 'section-rule mb-4'
      }`}
    >
      {text}
    </p>
  );
}

function ArrowButton({
  label,
  onClick,
  controls,
  direction,
}: {
  label: string;
  onClick: () => void;
  controls: string;
  direction: 'prev' | 'next';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-controls={controls}
      className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-chip)] border border-[var(--border)] text-[var(--foreground-muted)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--foreground)]"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {direction === 'prev' ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
      </svg>
    </button>
  );
}
