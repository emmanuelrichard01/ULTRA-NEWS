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
    <section aria-labelledby="unconfirmed-heading" className="flex flex-col">
      <h3
        id="unconfirmed-heading"
        className="mb-1 flex items-center gap-2 text-[13px] font-medium text-[var(--accent-secondary)]"
      >
        <span className="h-2 w-2 rounded-full border-[1.5px] border-[var(--accent-secondary)]" aria-hidden="true" />
        Not yet confirmed
      </h3>
      <p className="text-body-sm mb-4 text-[var(--foreground-subtle)]">
        Longest standing on one newsroom alone. Early, not doubtful.
      </p>

      <ol className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {unconfirmed.map(({ story, alone }) => {
          // Zero until mounted: `alone` is measured against the render's clock,
          // so a server-computed width never matches the client's and React
          // reports a hydration mismatch. The bar then animates in.
          const fill = now === null ? 0 : Math.min(alone / WATCH_HOURS, 1);
          return (
            <li key={story.slug} className="group relative py-4">
              <h4 className="text-[15px] font-medium leading-snug tracking-[-0.01em] text-[var(--foreground)]">
                <Link
                  href={`/story/${story.slug}`}
                  className="headline-link after:absolute after:inset-0 after:content-['']"
                >
                  {story.title}
                </Link>
              </h4>
              <div className="mt-2 flex items-center gap-3">
                <span className="font-data min-w-0 shrink truncate text-[11px] text-[var(--foreground-muted)]">
                  {story.sources?.[0] ?? 'One outlet'}
                </span>
                {/*
                  The track fills as the hours pass without a second newsroom.
                  Amber rather than the corroboration teal: this is the absence
                  of the signal, and it would be perverse to draw it in the
                  colour the product uses for evidence.
                */}
                <span
                  className="h-[3px] min-w-12 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full bg-[var(--accent-secondary)] transition-[width] duration-700"
                    style={{ width: `${Math.max(fill * 100, 4)}%`, opacity: 0.35 + fill * 0.5 }}
                  />
                </span>
                <span
                  className="font-data shrink-0 text-[11px] tabular-nums text-[var(--foreground-subtle)]"
                  suppressHydrationWarning
                >
                  {now === null ? '—' : `${durationLabel(alone)} alone`}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-caption mt-2 border-t border-[var(--border)] pt-3 text-[var(--foreground-subtle)]">
        A story leaves this list the moment a second independent newsroom files on it.
      </p>
    </section>
  );
}
