"use client";

import { useId, useMemo, useState } from 'react';

import {
  distinctiveWords,
  hasDivergence,
  isDistinctive,
  marksFor,
  tokenize,
} from '@/lib/framing';

/**
 * FramingCompare — how differently outlets headlined the same event.
 *
 * The instant hover of the original switcher was the right instinct: this is a
 * comparison, and a comparison wants to be *felt*, not clicked through. What
 * the original did with it was wrong in two ways.
 *
 *   1. It swapped the card's own headline. Selecting The Guardian REPLACED the
 *      words, so seeing what The Guardian did differently meant holding the
 *      previous wording in your head and toggling back and forth. Replacement
 *      is the one interaction that prevents comparison.
 *   2. It reserved dead space. Every candidate headline was rendered stacked in
 *      one grid cell with `invisible` on the inactive ones — and
 *      `visibility: hidden` still occupies space, so the cell sized to the
 *      LONGEST alternative. Roughly 50px of empty page sat under a one-line
 *      headline, on precisely the well-corroborated stories that matter most.
 *      Before that fix it was worse: the card reflowed on every hover, moving
 *      the buttons out from under the pointer, which selected a different
 *      outlet, which moved them again.
 *
 * Here the canonical headline never moves. The alternative wording appears in a
 * quotation slot beneath it — one fixed-height box, so nothing on the card can
 * shift no matter which outlet is active or how long its headline runs. Both
 * versions are on screen at once, which is the entire point.
 *
 * A first alternative is shown by default rather than waiting to be discovered.
 * The original's whole feature was invisible until you happened to hover the
 * right thing, so most readers never learned the product knew this.
 *
 * Words unique to one outlet are marked, using the same lib/framing.ts analysis
 * as the story page's FramingMatrix, so the feed is recognisably a preview of
 * the page it links to rather than a different idea about the same data.
 */

export interface Framing {
  source: string;
  title: string;
  url: string;
}

interface FramingCompareProps {
  framings: Framing[];
  /** Lead cards carry slightly more room than list rows. */
  size?: 'sm' | 'md';
}

export default function FramingCompare({
  framings,
  size = 'sm',
}: FramingCompareProps) {
  const [active, setActive] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const panelId = useId();

  // Outlets running a wire story verbatim produce identical headlines under
  // different names. Listing both would show the reader the same sentence twice
  // and inflate the count in the trigger.
  const entries = useMemo(() => {
    const seen = new Set<string>();
    return framings.filter((f) => {
      const key = f.title.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [framings]);

  const distinctive = useMemo(() => distinctiveWords(entries), [entries]);

  // Nothing to compare when outlets ran the same words, so nothing is offered.
  if (!hasDivergence(entries)) return null;

  const current = entries[Math.min(active, entries.length - 1)];
  const quoteSize = size === 'md' ? 'text-body-md' : 'text-body-sm';

  return (
    // z-10 lifts this above the card's stretched link so it stays clickable.
    <div className="relative z-10 mt-3">
      <div className="border-l-2 border-[var(--border-strong)] pl-3.5">
        <p className="text-label mb-1 text-[var(--foreground-subtle)]">
          As {current.source} headlined it
        </p>

        {/*
          Fixed height, always two lines' worth.

          This is the whole reason the card can no longer shift. Whichever
          outlet is active, and however long its headline, the slot is the same
          size — so moving the pointer across the outlet buttons cannot move the
          buttons themselves, which is the feedback loop the original hover
          interaction fell into.
        */}
        <p
          className={`${quoteSize} measure line-clamp-2 min-h-[2.75rem] font-display leading-snug text-[var(--foreground)] transition-opacity duration-150`}
          aria-live="polite"
        >
          {tokenize(current.title).map((word, i) =>
            isDistinctive(word, marksFor(current.title, distinctive)) ? (
              <mark
                key={i}
                className="rounded-[2px] bg-[var(--accent-secondary)]/20 px-[2px] text-[var(--foreground)]"
              >
                {word}
              </mark>
            ) : (
              <span key={i}>{word}</span>
            )
          )}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-label mr-0.5 text-[var(--foreground-subtle)]">
          Framing
        </span>

        {/*
          A tablist, not a row of divs with mouse handlers. The original swapped
          on `onMouseEnter` only: no touch device could reach it, and keyboard
          users could focus the buttons and have nothing happen. Hover is the
          shortcut here, not the mechanism — focus and click do the same thing.
        */}
        <div role="tablist" aria-label="Compare how outlets headlined this story" className="flex flex-wrap gap-1.5">
          {entries.map((frame, idx) => {
            const isActive = idx === active;
            return (
              <button
                key={`${frame.source}-${idx}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(idx)}
                onMouseEnter={() => setActive(idx)}
                onFocus={() => setActive(idx)}
                className={`font-data rounded-[var(--radius-chip)] border px-2 py-[3px] text-[11px] transition-colors ${
                  isActive
                    ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]'
                    : 'border-[var(--border)] bg-transparent text-[var(--foreground-muted)] hover:border-[var(--border-hover)] hover:text-[var(--foreground)]'
                }`}
              >
                {frame.source}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          aria-controls={panelId}
          className="text-label ml-1 text-[var(--foreground-subtle)] underline decoration-[var(--border-strong)] underline-offset-4 transition-colors hover:text-[var(--foreground)]"
        >
          {isExpanded ? 'Hide' : 'All side by side'}
        </button>
      </div>

      {isExpanded && (
        <div
          id={panelId}
          className="animate-fade-in-up mt-3 space-y-2.5 border-l-2 border-[var(--border-strong)] pl-3.5"
        >
          {entries.map((frame) => {
            const marks = marksFor(frame.title, distinctive);
            return (
              <div key={`all-${frame.source}-${frame.title}`}>
                <span className="text-label block text-[var(--foreground-subtle)]">
                  {frame.source}
                </span>
                <p className="text-body-sm measure mt-0.5 font-display leading-snug text-[var(--foreground)]">
                  {tokenize(frame.title).map((word, i) =>
                    isDistinctive(word, marks) ? (
                      <mark
                        key={i}
                        className="rounded-[2px] bg-[var(--accent-secondary)]/20 px-[2px] text-[var(--foreground)]"
                      >
                        {word}
                      </mark>
                    ) : (
                      <span key={i}>{word}</span>
                    )
                  )}
                </p>
              </div>
            );
          })}

          <p className="text-caption pt-0.5 text-[var(--foreground-subtle)]">
            Highlighted words appear in only one outlet&rsquo;s framing.
          </p>
        </div>
      )}
    </div>
  );
}
