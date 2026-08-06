"use client";

import { useEffect, useState } from 'react';

import type { StoryDetail } from '@/lib/types';

/**
 * Wire status — the state of the feed itself, in one line.
 *
 * The Wire is a live thing, and a page that looks identical whether ingestion
 * ran four minutes ago or four days ago gives a reader no way to tell a quiet
 * news day from a broken pipeline. This says which it is.
 *
 * Every figure is read off data already on the page — the archive total the API
 * returns with the feed, the newest story's timestamp, the publishers named in
 * the loaded stories. Nothing is estimated and nothing extra is fetched. A
 * status strip that invented a number would be a strange thing to put on a
 * product whose argument is that you can check the numbers.
 *
 * It sits beside the orientation sentence rather than in a band of its own.
 * As a full-width strip it was a fifth stacked row in a header that already had
 * too many, and its weight implied it was a control.
 */

interface WireStatusProps {
  stories: StoryDetail[];
  /** Archive-wide total for the current filter, from the API. */
  totalCount: number;
}

export default function WireStatus({ stories, totalCount }: WireStatusProps) {
  // Resolved after mount. A relative time computed during SSR is already stale
  // when it arrives, and the server's clock is not the reader's.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Deferred rather than called in the effect body: setting state
    // synchronously there triggers a second render pass before paint.
    const initial = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, []);

  if (stories.length === 0) return null;

  const newest = stories.reduce((latest, s) =>
    new Date(s.first_seen_at) > new Date(latest.first_seen_at) ? s : latest
  );

  /**
   * Distinct newsrooms represented in what is currently loaded.
   *
   * This slot first held "N/20 loaded with 2+ outlets", which was accurate and
   * useless: on a recency-ordered feed of a corpus that is mostly single-source
   * it reads "0/20" nearly always, sitting directly above a hero captioned "2
   * outlets" and appearing to contradict it. A statistic whose honest value is
   * almost always zero teaches the reader to ignore the strip.
   *
   * The count of distinct publishers is the same underlying fact stated the way
   * round that carries information — it moves, it is never zero while there are
   * stories, and breadth of sourcing is what the product is for.
   */
  const outletCount = new Set(stories.flatMap((s) => s.sources ?? [])).size;

  const minutesSince =
    now === null
      ? null
      : Math.max(
          0,
          Math.round((now - new Date(newest.first_seen_at).getTime()) / 60000)
        );

  // "Live" is a claim, so there is a threshold behind it: ingestion runs every
  // 15 minutes, so anything inside two hours is the pipeline working normally.
  const isLive = minutesSince !== null && minutesSince < 120;

  return (
    <div className="font-data flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tabular-nums text-[var(--foreground-subtle)]">
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          {isLive && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-60" />
          )}
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: isLive
                ? 'var(--accent)'
                : 'var(--foreground-subtle)',
            }}
          />
        </span>
        <span className="font-semibold text-[var(--foreground-muted)]">
          {minutesSince === null ? 'Wire' : isLive ? 'Wire live' : 'Wire quiet'}
        </span>
      </span>

      {minutesSince !== null && (
        <>
          <Dot />
          <span>
            newest{' '}
            {minutesSince < 1
              ? 'just now'
              : minutesSince < 60
              ? `${minutesSince}m ago`
              : `${Math.round(minutesSince / 60)}h ago`}
          </span>
        </>
      )}

      {outletCount > 0 && (
        <>
          <Dot />
          <span>
            {outletCount} {outletCount === 1 ? 'newsroom' : 'newsrooms'}
          </span>
        </>
      )}

      <Dot />
      <span>{totalCount.toLocaleString()} archived</span>
    </div>
  );
}

function Dot() {
  return (
    <span aria-hidden="true" className="text-[var(--border-strong)]">
      ·
    </span>
  );
}
