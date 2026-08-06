"use client";

import { useMemo, useState } from 'react';

import {
  distinctiveWords,
  framingsByOutlet,
  isDistinctive,
  marksFor,
  tokenize,
} from '@/lib/framing';
import type { StoryArticle } from '@/lib/types';

/**
 * FramingMatrix — how differently outlets headlined the same event.
 *
 * The most quietly useful thing on the page. Two newsrooms reporting identical
 * facts will choose different subjects, different verbs and different omissions,
 * and laying those side by side shows editorial slant more honestly than any
 * bias score could — the reader draws their own conclusion from primary evidence
 * rather than trusting our label.
 *
 * Previously this existed only as a hover-swap on feed cards, which meant no
 * touch or keyboard user ever saw it, and the headlines were never shown
 * together — the entire point of the comparison.
 *
 * Words unique to a single outlet's headline are marked, because that is where
 * framing lives: "strikes kill five" versus "retaliatory operation" is the
 * story.
 *
 * The word analysis itself lives in lib/framing.ts, shared with the feed
 * card's FramingCompare. Two copies of it would eventually disagree, and the
 * same story would then highlight different words on the feed than on the page
 * it links to.
 */

interface FramingMatrixProps {
  articles: StoryArticle[];
}

export default function FramingMatrix({ articles }: FramingMatrixProps) {
  const [showAll, setShowAll] = useState(false);

  const perOutlet = useMemo(
    () =>
      framingsByOutlet(
        articles.map((a) => ({
          source: a.source.name,
          title: a.title,
          publishedAt: a.published_date,
          article: a,
        }))
      ),
    [articles]
  );

  const distinctive = useMemo(() => distinctiveWords(perOutlet), [perOutlet]);

  if (perOutlet.length < 2) return null;

  const visible = showAll ? perOutlet : perOutlet.slice(0, 5);

  return (
    <section aria-labelledby="framing-heading" className="border-t border-[var(--border)] py-12">
      <h2 id="framing-heading" className="text-display-md font-display text-[var(--foreground)]">
        How outlets framed it
      </h2>
      <p className="text-body-sm measure mb-8 mt-1.5 text-[var(--foreground-muted)]">
        The same event, as each newsroom chose to headline it. Highlighted words
        appear in only one outlet&rsquo;s framing.
      </p>

      <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {visible.map((entry) => {
          const marks = marksFor(entry.title, distinctive);
          return (
          <li key={entry.source} className="grid gap-1.5 py-4 sm:grid-cols-[9rem_1fr] sm:gap-5">
            <span className="font-data pt-[3px] text-[12px] font-semibold text-[var(--foreground-muted)]">
              {entry.source}
            </span>
            <p className="text-body-md font-display leading-snug text-[var(--foreground)]">
              {tokenize(entry.title).map((word, i) =>
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
          </li>
          );
        })}
      </ul>

      {perOutlet.length > visible.length && (
        <button
          onClick={() => setShowAll(true)}
          className="text-label mt-4 rounded-[var(--radius-chip)] border border-[var(--border)] px-3 py-2 text-[var(--foreground-muted)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--foreground)]"
        >
          Show all {perOutlet.length} framings
        </button>
      )}
    </section>
  );
}
