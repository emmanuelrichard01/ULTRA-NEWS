"use client";

import { useMemo, useState } from 'react';

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
 */

interface FramingMatrixProps {
  articles: StoryArticle[];
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for',
  'with', 'as', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'it',
  'its', 'that', 'this', 'has', 'have', 'had', 'will', 'says', 'say', 'said',
  'after', 'over', 'into', 'more', 'than', 'his', 'her', 'their', 'they',
]);

function contentWords(title: string): string[] {
  return (title.toLowerCase().match(/\b[a-z][a-z'-]{2,}\b/g) ?? []).filter(
    (w) => !STOPWORDS.has(w)
  );
}

export default function FramingMatrix({ articles }: FramingMatrixProps) {
  const [showAll, setShowAll] = useState(false);

  // One headline per outlet — the earliest, which is its initial framing before
  // it had a chance to follow anyone else's lead.
  const perOutlet = useMemo(() => {
    const byOutlet = new Map<string, StoryArticle>();
    [...articles]
      .sort((a, b) => new Date(a.published_date).getTime() - new Date(b.published_date).getTime())
      .forEach((a) => {
        if (!byOutlet.has(a.source.name)) byOutlet.set(a.source.name, a);
      });
    return [...byOutlet.values()];
  }, [articles]);

  // A word is "distinctive" when only one outlet used it.
  const distinctive = useMemo(() => {
    const counts = new Map<string, number>();
    perOutlet.forEach((a) => {
      new Set(contentWords(a.title)).forEach((w) => counts.set(w, (counts.get(w) ?? 0) + 1));
    });
    return new Set([...counts.entries()].filter(([, n]) => n === 1).map(([w]) => w));
  }, [perOutlet]);

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
        {visible.map((article) => {
          const words = article.title.split(/(\s+)/);
          return (
            <li key={article.source.name} className="grid gap-1.5 py-4 sm:grid-cols-[9rem_1fr] sm:gap-5">
              <span className="font-data pt-[3px] text-[12px] font-semibold text-[var(--foreground-muted)]">
                {article.source.name}
              </span>
              <p className="text-body-md font-display leading-snug text-[var(--foreground)]">
                {words.map((word, i) => {
                  const bare = word.toLowerCase().replace(/[^a-z'-]/g, '');
                  const isDistinctive = bare.length > 2 && distinctive.has(bare);
                  return isDistinctive ? (
                    <mark
                      key={i}
                      className="rounded-[2px] bg-[var(--accent-secondary)]/20 px-[2px] text-[var(--foreground)]"
                    >
                      {word}
                    </mark>
                  ) : (
                    <span key={i}>{word}</span>
                  );
                })}
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
