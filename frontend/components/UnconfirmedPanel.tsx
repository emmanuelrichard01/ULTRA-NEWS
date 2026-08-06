"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { durationLabel, hoursSince } from '@/lib/spread';
import type { StoryDetail } from '@/lib/types';

/**
 * Not yet confirmed — the other half of the wire.
 *
 * This sits beside the lead deliberately, and the pairing is the point. The
 * lead slot shows the most recent reporting that a second newsroom has stood
 * up. This shows the most recent reporting that nobody has. Same wire, same
 * hour, split by the one question the product exists to answer — and a reader
 * who takes in both at a glance has understood what Ultra News is without
 * reading a word of explanation.
 *
 * Every news front page has a second column. On most of them it is "most read"
 * or "editor's picks" — rankings of attention, which is the metric this project
 * was built as an argument against. Ranking by what is NOT yet confirmed is
 * available to almost nobody else, because it requires knowing which distinct
 * publishers are behind a cluster, and that is exactly what this pipeline
 * computes.
 *
 * **What makes a row interesting is age, not the fact of being alone.**
 *
 * The first version listed one outlet and a headline, which is the same shape
 * as every other list on the page and says nothing a reader could act on —
 * almost everything on a wire is single-source in its first minutes, so "one
 * outlet" on a fresh story is not news about the story, it is news about the
 * clock. A report that has stood alone for nine hours is a different object
 * entirely: either nobody else can confirm it, or it is one newsroom's own
 * work. Both are worth a reader's attention, and neither is visible from a
 * count.
 *
 * So each row states how long it has been alone and draws that as a filling
 * track. Rows are ordered by that age, longest first, which puts the ones that
 * have had the most opportunity to be confirmed — and weren't — at the top.
 *
 * The framing is careful, and the wording matters more than the layout here. A
 * single-source story is not a false story: original investigative reporting
 * begins at one outlet by definition, and most of these are simply early. This
 * is not a discredit list. It says what is true — one newsroom is carrying it,
 * and for how long — and nothing beyond that.
 */

interface UnconfirmedPanelProps {
  stories: StoryDetail[];
  limit?: number;
}

/** Where the track reads as full. Beyond half a day, alone is the story. */
const WATCH_HOURS = 12;

export default function UnconfirmedPanel({
  stories,
  limit = 5,
}: UnconfirmedPanelProps) {
  // Ages are computed after mount. Rendering "9h alone" on the server bakes a
  // stale figure into a page that is cached for a minute and then served for
  // as long as it stays fresh.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const initial = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, []);

  const unconfirmed = stories
    .filter((s) => s.independent_count <= 1)
    .map((s) => ({ story: s, alone: hoursSince(s.first_seen_at) }))
    .sort((a, b) => b.alone - a.alone)
    .slice(0, limit);

  if (unconfirmed.length === 0) return null;

  return (
    <section
      aria-labelledby="unconfirmed-heading"
      className="flex h-full flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <h2
        id="unconfirmed-heading"
        className="text-label text-[var(--foreground-muted)]"
      >
        Not yet confirmed
      </h2>
      <p className="text-body-sm mt-1 text-[var(--foreground-subtle)]">
        Longest standing on one newsroom alone. Early, not doubtful.
      </p>

      {/*
        `min-h-0` matters here. A flex item's default minimum size is its
        content, which would push the card past the height its cell allots and
        defeat the point of matching the hero. With it, the list takes the
        space that is left and scrolls if the day is busy — the heading and the
        footing stay put either way.
      */}
      <ol className="scroll-slim mt-4 min-h-0 flex-1 space-y-3.5 overflow-y-auto">
        {unconfirmed.map(({ story, alone }) => {
          const fill = Math.min(alone / WATCH_HOURS, 1);
          return (
            <li
              key={story.slug}
              className="relative border-t border-[var(--border)] pt-3.5 first:border-0 first:pt-0"
            >
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="font-data min-w-0 truncate text-[11px] text-[var(--foreground-muted)]">
                  {story.sources?.[0] ?? 'One outlet'}
                </span>
                <span
                  className="font-data ml-auto shrink-0 text-[11px] tabular-nums text-[var(--foreground-subtle)]"
                  suppressHydrationWarning
                >
                  {now === null ? '—' : `${durationLabel(alone)} alone`}
                </span>
              </div>

              {/*
                The track fills as the hours pass without a second newsroom.
                Amber rather than the corroboration teal: this is the absence of
                the signal, and it would be perverse to draw it in the colour
                the product uses for evidence.
              */}
              <div
                className="mb-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]"
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full bg-[var(--accent-secondary)] transition-[width] duration-500"
                  style={{ width: `${Math.max(fill * 100, 4)}%`, opacity: 0.35 + fill * 0.5 }}
                />
              </div>

              <h3 className="text-body-sm font-display leading-snug text-[var(--foreground)]">
                <Link
                  href={`/story/${story.slug}`}
                  className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-[var(--accent)]"
                >
                  {story.title}
                </Link>
              </h3>
            </li>
          );
        })}
      </ol>

      <p className="text-caption mt-4 border-t border-[var(--border)] pt-3 text-[var(--foreground-subtle)]">
        A story leaves this list the moment a second independent newsroom files
        on it.
      </p>
    </section>
  );
}
