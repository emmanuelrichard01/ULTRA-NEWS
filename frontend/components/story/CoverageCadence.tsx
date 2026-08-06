"use client";

import { useMemo, useState } from 'react';

import type { StoryArticle } from '@/lib/types';

/**
 * CoverageCadence — when each outlet picked the story up.
 *
 * This chart earns its place because its SHAPE answers a question no list of
 * timestamps does: did these outlets independently verify the story, or did they
 * all run the same wire copy within minutes of each other?
 *
 * Six outlets publishing inside twenty minutes is one wire feeding everyone —
 * six copies of a single act of reporting. Six outlets spread across nine hours
 * is much more likely to be independent pickup. Both look identical in a
 * corroboration count, which is precisely why the count alone can mislead, and
 * why the distribution is worth drawing.
 *
 * Form: a one-dimensional strip plot. Not a line (nothing is continuous between
 * publications) and not bars (there is no magnitude per outlet) — each mark is
 * one event positioned in time, and clustering is the signal.
 *
 * Single series, so one hue and no legend: the heading names what the marks are.
 * Marks overlapping in a pile-on carry a surface ring so they stay countable.
 */

interface CoverageCadenceProps {
  articles: StoryArticle[];
}

interface Mark {
  outlet: string;
  at: Date;
  /** Position along the axis, 0–100. */
  x: number;
  isFirst: boolean;
}

function formatSpan(minutes: number): string {
  if (minutes < 60) return `${Math.max(Math.round(minutes), 1)} minutes`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)} hours`;
  return `${Math.round(hours / 24)} days`;
}

/**
 * Read the shape honestly.
 *
 * Deliberately hedged — "consistent with" rather than "is". Publish timestamps
 * cannot prove syndication, and a confident claim here would be exactly the kind
 * of unearned verdict this product exists to avoid.
 */
function interpret(outletCount: number, spanMinutes: number): string {
  if (outletCount < 2) return 'Only one outlet has published so far.';
  if (spanMinutes < 30) {
    return `All ${outletCount} outlets published within ${formatSpan(spanMinutes)} — a burst this tight is consistent with shared wire copy rather than separate reporting.`;
  }
  if (spanMinutes < 180) {
    return `${outletCount} outlets published over ${formatSpan(spanMinutes)} — a fast pickup, typical of a developing story on the wires.`;
  }
  return `${outletCount} outlets published over ${formatSpan(spanMinutes)} — a spread this wide suggests newsrooms picking the story up separately.`;
}

export default function CoverageCadence({ articles }: CoverageCadenceProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { marks, spanMinutes, firstAt, lastAt } = useMemo(() => {
    // One mark per outlet, at its first publication. A newsroom filing three
    // updates is one pickup, not three.
    const firstByOutlet = new Map<string, Date>();
    articles.forEach((a) => {
      const at = new Date(a.published_date);
      const existing = firstByOutlet.get(a.source.name);
      if (!existing || at < existing) firstByOutlet.set(a.source.name, at);
    });

    const entries = [...firstByOutlet.entries()].sort((a, b) => a[1].getTime() - b[1].getTime());
    if (entries.length === 0) {
      return { marks: [] as Mark[], spanMinutes: 0, firstAt: null, lastAt: null };
    }

    const start = entries[0][1].getTime();
    const end = entries[entries.length - 1][1].getTime();
    const span = Math.max(end - start, 1);

    return {
      marks: entries.map(([outlet, at], i) => ({
        outlet,
        at,
        // A single-outlet story sits at the start rather than dividing by zero.
        x: entries.length === 1 ? 0 : ((at.getTime() - start) / span) * 100,
        isFirst: i === 0,
      })),
      spanMinutes: (end - start) / 60000,
      firstAt: entries[0][1],
      lastAt: entries[entries.length - 1][1],
    };
  }, [articles]);

  if (marks.length < 2) return null;

  const timeFmt: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

  return (
    <section aria-labelledby="cadence-heading" className="border-t border-[var(--border)] py-12">
      <h2 id="cadence-heading" className="text-display-md font-display text-[var(--foreground)]">
        Pickup pattern
      </h2>
      <p className="text-body-sm measure mb-8 mt-1.5 text-[var(--foreground-muted)]">
        {interpret(marks.length, spanMinutes)}
      </p>

      {/* Plot. Generous top padding leaves room for the hover tooltip. */}
      <div className="relative pt-10">
        <div className="relative h-8">
          {/* Axis — recessive, as the skill requires. */}
          <div
            className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--border)]"
            aria-hidden="true"
          />

          {marks.map((mark, i) => {
            const isHovered = hovered === i;
            return (
              <button
                key={mark.outlet}
                type="button"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                // Hit target is far larger than the 10px mark it contains.
                className="absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${mark.x}%` }}
                aria-label={`${mark.outlet} published at ${mark.at.toLocaleTimeString('en-GB', timeFmt)}`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform ${
                    isHovered ? 'scale-125' : ''
                  }`}
                  style={{
                    width: mark.isFirst ? 12 : 10,
                    height: mark.isFirst ? 12 : 10,
                    background: mark.isFirst ? 'var(--accent)' : 'var(--surface-elevated)',
                    // A 2px surface ring keeps marks countable where a pile-on
                    // stacks them on top of one another.
                    boxShadow: `0 0 0 2px var(--background), inset 0 0 0 2px var(--accent)`,
                  }}
                />
              </button>
            );
          })}

          {/* Tooltip */}
          {hovered !== null && (
            <div
              role="status"
              className="pointer-events-none absolute bottom-full z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-chip)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1.5 shadow-[var(--shadow-md)]"
              style={{
                left: `${Math.min(Math.max(marks[hovered].x, 12), 88)}%`,
              }}
            >
              <span className="font-data block text-[12px] font-semibold text-[var(--foreground)]">
                {marks[hovered].outlet}
              </span>
              <span className="font-data block text-[11px] text-[var(--foreground-muted)]">
                {marks[hovered].at.toLocaleTimeString('en-GB', timeFmt)}
                {marks[hovered].isFirst && ' · broke it'}
              </span>
            </div>
          )}
        </div>

        {/* Axis ends */}
        <div className="mt-1 flex justify-between">
          <span className="font-data text-[11px] text-[var(--foreground-subtle)]">
            {firstAt?.toLocaleTimeString('en-GB', timeFmt)} · first
          </span>
          <span className="font-data text-[11px] text-[var(--foreground-subtle)]">
            {lastAt?.toLocaleTimeString('en-GB', timeFmt)} · latest
          </span>
        </div>
      </div>

      {/* Identity is never color-alone: the same data is available as text. */}
      <details className="group mt-6">
        <summary className="text-label cursor-pointer list-none text-[var(--foreground-muted)] transition-colors marker:content-[''] hover:text-[var(--foreground)]">
          <span className="inline-flex items-center gap-1.5">
            View as table
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="transition-transform group-open:rotate-180" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </summary>
        <table className="mt-3 w-full text-left">
          <caption className="sr-only">
            Time each outlet first published this story
          </caption>
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th scope="col" className="text-label py-1.5 text-[var(--foreground-subtle)]">Outlet</th>
              <th scope="col" className="text-label py-1.5 text-[var(--foreground-subtle)]">Published</th>
            </tr>
          </thead>
          <tbody>
            {marks.map((mark) => (
              <tr key={mark.outlet} className="border-b border-[var(--border)] last:border-0">
                <td className="text-body-sm py-1.5 text-[var(--foreground)]">
                  {mark.outlet}
                  {mark.isFirst && (
                    <span className="font-data ml-2 text-[11px] text-[var(--accent)]">broke it</span>
                  )}
                </td>
                <td className="font-data py-1.5 text-[12px] tabular-nums text-[var(--foreground-muted)]">
                  {mark.at.toLocaleTimeString('en-GB', timeFmt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
