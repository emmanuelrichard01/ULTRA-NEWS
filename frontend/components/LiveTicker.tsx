"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

import CorroborationMeter from './CorroborationMeter';
import type { StoryDetail } from '@/lib/types';

/**
 * The wire — a moving strip that still makes the product's one claim.
 *
 * Most tickers are a red "LIVE" pill and a line of headlines: they say that
 * news is happening, not how much of it can be trusted. This one reads like
 * an instrument panel for the wire instead:
 *
 *   The desk      a clock, and the state of the strip in the product's own
 *                 terms: how many of these stories are confirmed by two or
 *                 more newsrooms and how many rest on one. No pulsing dot;
 *                 the numbers are the signal.
 *   Each item     the corroboration bars and count lead, before the
 *                 headline, so a reader can skim the evidence without
 *                 reading a word. A story still gaining outlets carries its
 *                 momentum (+3); one first seen in the last hour is marked
 *                 new; each ends with how long ago it moved.
 *   Spotlight     hovering one headline dims the rest, so the moving strip
 *                 becomes readable where the reader's attention actually is.
 *   Control       a real pause button (WCAG 2.2.2: moving content that runs
 *                 over five seconds must be stoppable), on top of the
 *                 pause-on-hover and pause-on-focus the strip already had.
 *
 * Speed scales with the number of items, so a short strip doesn't crawl and a
 * long one doesn't race. Under reduced motion there is no animation at all:
 * the strip is a horizontally scrollable list.
 *
 * The stories arrive with the front page's own fetch, so the strip is in the
 * first HTML byte and costs no request. Times and the clock render after
 * mount, where the reader's clock is, never the server's.
 */

const SECONDS_PER_ITEM = 7;
const FRESH_MS = 60 * 60 * 1000;

export default function LiveTicker({ stories }: { stories: StoryDetail[] }) {
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);

  const seen = new Set<string>();
  const items = stories
    .filter((s) => {
      if (seen.has(s.slug)) return false;
      seen.add(s.slug);
      return true;
    })
    .slice(0, 10);

  if (items.length < 3) return null;

  const confirmed = items.filter((s) => s.independent_count >= 2).length;
  const single = items.length - confirmed;

  // Rendered twice back to back; the marquee translates by exactly one copy's
  // width (-50%) so the loop is seamless. The second copy is hidden from
  // assistive tech and from the tab order.
  const run = (copy: number) =>
    items.map((story) => {
      const moved = new Date(story.last_updated_at).getTime();
      const fresh = now !== null && now - new Date(story.first_seen_at).getTime() < FRESH_MS;
      const gaining = (story.recent_outlets ?? 0) > 0;
      return (
        <li
          key={`${copy}-${story.slug}`}
          aria-hidden={copy === 1 ? true : undefined}
          className="wire-item flex shrink-0 items-center gap-3 border-r border-[var(--border)] px-5 transition-opacity duration-300"
        >
          <CorroborationMeter outlets={story.independent_count} size="sm" showLabel={false} className="!gap-1.5" />
          <Link
            href={`/story/${story.slug}`}
            tabIndex={copy === 0 ? undefined : -1}
            className="max-w-[34rem] truncate whitespace-nowrap text-[13px] font-medium text-[var(--foreground)] transition-colors hover:text-[var(--accent)] focus-visible:text-[var(--accent)]"
          >
            {story.title}
          </Link>
          {gaining && (
            <span
              className="font-data rounded-[4px] bg-[var(--accent)]/10 px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--accent)]"
              title={`${story.recent_outlets} newsrooms joined recently`}
            >
              +{story.recent_outlets}
            </span>
          )}
          {fresh && !gaining && (
            <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--verified-teal)]">New</span>
          )}
          {now !== null && (
            <span className="font-data whitespace-nowrap text-[11px] tabular-nums text-[var(--foreground-subtle)]">
              {ago(now - moved)}
            </span>
          )}
        </li>
      );
    });

  return (
    <section
      aria-label="Latest on the wire"
      className="wire-strip mb-8 flex items-stretch overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-sm)]"
    >
      {/* The desk */}
      <div className="flex shrink-0 flex-col justify-center border-r border-[var(--border)] px-4 py-2.5 sm:px-5">
        <p className="flex items-baseline gap-2">
          <span className="font-display text-[19px] leading-none text-[var(--foreground)]">The wire</span>
          <span className="font-data hidden text-[11px] tabular-nums text-[var(--foreground-subtle)] sm:inline" suppressHydrationWarning>
            {now !== null
              ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : ''}
          </span>
        </p>
        <p className="font-data mt-1 hidden whitespace-nowrap text-[10px] uppercase tracking-[0.06em] text-[var(--foreground-subtle)] md:block">
          <span className="text-[var(--verified-teal)]">{confirmed} confirmed</span>
          <span aria-hidden="true"> · </span>
          {single} single-source
        </p>
      </div>

      {/* The strip */}
      <div className="ticker-mask pb-scrollbar min-w-0 flex-1 overflow-x-auto motion-safe:overflow-hidden">
        <ul
          className="wire-list animate-marquee flex h-full w-max items-center py-3"
          // Inline, so it outranks the animation shorthand on .animate-marquee,
          // which would otherwise reset play-state to running.
          style={{
            animationDuration: `${items.length * SECONDS_PER_ITEM}s`,
            ...(paused ? { animationPlayState: 'paused' } : {}),
          }}
        >
          {run(0)}
          {run(1)}
        </ul>
      </div>

      {/* Control */}
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? 'Resume the wire' : 'Pause the wire'}
        className="hidden shrink-0 items-center justify-center border-l border-[var(--border)] px-4 text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)] motion-safe:flex"
      >
        {paused ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="5" y="4" width="4.5" height="16" rx="1" />
            <rect x="14.5" y="4" width="4.5" height="16" rx="1" />
          </svg>
        )}
      </button>
    </section>
  );
}

/** Compact age: "4m", "3h", "2d". */
function ago(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
