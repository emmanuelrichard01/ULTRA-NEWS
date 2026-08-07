"use client";

import { useMemo, useState } from 'react';

import { groupByOutlet } from '@/lib/outlets';
import type { StoryArticle } from '@/lib/types';

/**
 * CoverageCadence — how the corroboration count actually accrued.
 *
 * A step curve: time along the bottom, cumulative independent newsrooms up the
 * side. Each step is one newsroom publishing for the first time.
 *
 * **Why this replaced a strip plot.** The previous version laid one mark per
 * outlet along a single time axis, on the argument that clustering is the
 * signal — six outlets inside twenty minutes is consistent with one wire
 * feeding everyone, six over nine hours is not. That argument is right, and the
 * form could not carry it. Measured on a live story: eighty-four hours from
 * first to last, one mark at 0%, one at 54%, and thirteen of seventeen crammed
 * between 78% and 100%. The marks that mattered were an unreadable pile, and
 * the reader could not count them, let alone read a rhythm from them.
 *
 * A cumulative curve turns exactly that clustering into its most legible
 * feature: a flat stretch is a story nobody has followed yet, and a near
 * vertical rise is a pile-on. Overlapping events stack instead of colliding,
 * so the shape gets *clearer* as coverage gets denser, which is the opposite of
 * how the strip plot failed.
 *
 * It also plots the right quantity. The chart this product started with drew
 * cumulative ARTICLES, so one newsroom filing three updates looked identical to
 * three newsrooms confirming. The y-axis here is the corroboration count
 * itself — the number in the masthead, drawn over time — grouped by publisher
 * through lib/outlets.ts so a newsroom still cannot corroborate itself.
 *
 * And it can mark the thresholds. Because the y-axis IS the count, the moments
 * the story crossed into "confirmed" (2) and "corroborated" (3) are points on
 * the curve, so the page can say a story was confirmed forty minutes after it
 * broke. Nothing else in the product could state that.
 */

interface CoverageCadenceProps {
  articles: StoryArticle[];
}

interface Step {
  outlet: string;
  at: Date;
  /** Cumulative independent newsrooms after this one published. */
  count: number;
  x: number;
  y: number;
}

const W = 720;
const H = 240;
const PAD = { top: 18, right: 16, bottom: 30, left: 38 };

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
 * cannot prove syndication, and a confident claim here would be exactly the
 * kind of unearned verdict this product exists to avoid.
 */
function interpret(outletCount: number, spanMinutes: number): string {
  if (outletCount < 2) return 'Only one newsroom has published so far.';
  if (spanMinutes < 30) {
    return `All ${outletCount} newsrooms published within ${formatSpan(spanMinutes)} — a burst this tight is consistent with shared wire copy rather than separate reporting.`;
  }
  if (spanMinutes < 180) {
    return `${outletCount} newsrooms published over ${formatSpan(spanMinutes)} — a fast pickup, typical of a developing story on the wires.`;
  }
  return `${outletCount} newsrooms published over ${formatSpan(spanMinutes)} — a spread this wide suggests newsrooms picking the story up separately.`;
}

export default function CoverageCadence({ articles }: CoverageCadenceProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { steps, path, spanMinutes, firstAt, lastAt, maxCount, crossings } =
    useMemo(() => {
      const outlets = groupByOutlet(articles);
      if (outlets.length < 2) {
        return {
          steps: [] as Step[],
          path: '',
          spanMinutes: 0,
          firstAt: null as Date | null,
          lastAt: null as Date | null,
          maxCount: 0,
          crossings: [] as { level: number; minutes: number }[],
        };
      }

      const start = outlets[0].firstPublishedAt.getTime();
      const end = outlets[outlets.length - 1].firstPublishedAt.getTime();
      const span = Math.max(end - start, 1);
      const total = outlets.length;

      const xOf = (t: number) =>
        PAD.left + ((t - start) / span) * (W - PAD.left - PAD.right);
      const yOf = (n: number) =>
        H - PAD.bottom - (n / total) * (H - PAD.top - PAD.bottom);

      const built: Step[] = outlets.map((o, i) => ({
        outlet: o.name,
        at: o.firstPublishedAt,
        count: i + 1,
        x: xOf(o.firstPublishedAt.getTime()),
        y: yOf(i + 1),
      }));

      // Step path: hold the current count, jump at each new newsroom. Drawn as
      // explicit horizontal-then-vertical segments so the flat stretches — the
      // periods when nobody followed — are literally flat.
      const d: string[] = [`M ${built[0].x.toFixed(1)} ${yOf(0).toFixed(1)}`];
      built.forEach((s, i) => {
        if (i > 0) d.push(`L ${s.x.toFixed(1)} ${built[i - 1].y.toFixed(1)}`);
        d.push(`L ${s.x.toFixed(1)} ${s.y.toFixed(1)}`);
      });
      // Carry the final level to the right edge: the count has not dropped, the
      // story simply stopped being picked up.
      d.push(`L ${(W - PAD.right).toFixed(1)} ${built[built.length - 1].y.toFixed(1)}`);

      // When the story crossed into confirmed and corroborated.
      const marks = [2, 3]
        .filter((level) => total >= level)
        .map((level) => ({
          level,
          minutes:
            (outlets[level - 1].firstPublishedAt.getTime() - start) / 60000,
        }));

      return {
        steps: built,
        path: d.join(' '),
        spanMinutes: span / 60000,
        firstAt: outlets[0].firstPublishedAt,
        lastAt: outlets[outlets.length - 1].firstPublishedAt,
        maxCount: total,
        crossings: marks,
      };
    }, [articles]);

  if (steps.length < 2) return null;

  const timeFmt: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const dateFmt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const yOf = (n: number) =>
    H - PAD.bottom - (n / maxCount) * (H - PAD.top - PAD.bottom);

  // Two or three ticks, always including the top. More would be clutter on a
  // count that rarely exceeds twenty.
  const yTicks = [...new Set([1, Math.round(maxCount / 2), maxCount])]
    .filter((n) => n >= 1)
    .sort((a, b) => a - b);

  const active = hovered !== null ? steps[hovered] : null;

  return (
    <section aria-labelledby="cadence-heading" className="border-t border-[var(--border)] py-12">
      <h2 id="cadence-heading" className="text-display-md font-display text-[var(--foreground)]">
        How corroboration built up
      </h2>
      <p className="text-body-sm measure mb-6 mt-1.5 text-[var(--foreground-muted)]">
        {interpret(maxCount, spanMinutes)}
      </p>

      {/*
        Threshold crossings, in words above the chart.

        The single most useful sentence this data supports, and it is only
        sayable because the y-axis is the corroboration count rather than a
        volume of articles.
      */}
      {crossings.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2">
          {crossings.map(({ level, minutes }) => (
            <p key={level} className="text-body-sm text-[var(--foreground-muted)]">
              <span
                className="font-data font-semibold"
                style={{
                  color:
                    level >= 3 ? 'var(--verified-teal)' : 'var(--signal-amber)',
                }}
              >
                {level >= 3 ? 'Corroborated' : 'Confirmed'}
              </span>{' '}
              {minutes < 1 ? 'immediately' : `after ${formatSpan(minutes)}`}
            </p>
          ))}
        </div>
      )}

      <figure className="m-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={`Cumulative independent newsrooms over time: ${maxCount} newsrooms across ${formatSpan(spanMinutes)}. The table below lists every value.`}
        >
          {/* Gridlines and y labels. Recessive: the curve is the content. */}
          {yTicks.map((n) => (
            <g key={n}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={yOf(n)}
                y2={yOf(n)}
                stroke="var(--border)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD.left - 8}
                y={yOf(n) + 4}
                textAnchor="end"
                className="font-data"
                fontSize="11"
                fill="var(--foreground-subtle)"
              >
                {n}
              </text>
            </g>
          ))}

          {/* Threshold bands, in the same two signal colours as the meter. */}
          {crossings.map(({ level }) => (
            <line
              key={`t-${level}`}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yOf(level)}
              y2={yOf(level)}
              stroke={level >= 3 ? 'var(--verified-teal)' : 'var(--signal-amber)'}
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Area under the curve, very faint — gives the shape mass without
              competing with the stroke. */}
          <path
            d={`${path} L ${(W - PAD.right).toFixed(1)} ${yOf(0).toFixed(1)} L ${steps[0].x.toFixed(1)} ${yOf(0).toFixed(1)} Z`}
            fill="var(--accent)"
            opacity="0.07"
          />

          <path
            d={path}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* One target per newsroom. The hit area is far larger than the dot,
              and each is focusable so the chart is reachable by keyboard. */}
          {steps.map((s, i) => (
            <g key={s.outlet}>
              <circle
                cx={s.x}
                cy={s.y}
                r={i === 0 ? 4.5 : 3.5}
                fill={i === 0 ? 'var(--accent)' : 'var(--background)'}
                stroke="var(--accent)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={s.x}
                cy={s.y}
                r="14"
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${s.outlet}, newsroom ${s.count} of ${maxCount}, published ${s.at.toLocaleString('en-GB', { ...dateFmt, ...timeFmt })}`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                className="cursor-pointer focus:outline-none"
              />
            </g>
          ))}

          {/* Marker for the hovered step, drawn last so it sits on top. */}
          {active && (
            <line
              x1={active.x}
              x2={active.x}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--foreground)"
              strokeWidth="1"
              opacity="0.25"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* x axis ends */}
          <text
            x={PAD.left}
            y={H - 8}
            className="font-data"
            fontSize="11"
            fill="var(--foreground-subtle)"
          >
            {firstAt?.toLocaleDateString('en-GB', dateFmt)}{' '}
            {firstAt?.toLocaleTimeString('en-GB', timeFmt)}
          </text>
          <text
            x={W - PAD.right}
            y={H - 8}
            textAnchor="end"
            className="font-data"
            fontSize="11"
            fill="var(--foreground-subtle)"
          >
            {lastAt?.toLocaleDateString('en-GB', dateFmt)}{' '}
            {lastAt?.toLocaleTimeString('en-GB', timeFmt)}
          </text>
        </svg>

        {/* Reserved height, so the figure does not jump as the pointer moves
            across it. */}
        <figcaption className="mt-2 flex min-h-[2.5rem] items-start">
          {active ? (
            <span className="text-body-sm text-[var(--foreground)]">
              <span className="font-data font-semibold">{active.outlet}</span>
              <span className="text-[var(--foreground-subtle)]">
                {' '}
                — newsroom {active.count} of {maxCount},{' '}
                {active.at.toLocaleString('en-GB', { ...dateFmt, ...timeFmt })}
              </span>
            </span>
          ) : (
            <span className="text-body-sm text-[var(--foreground-subtle)]">
              Each step is one newsroom publishing for the first time. Hover a
              point for the outlet and time.
            </span>
          )}
        </figcaption>
      </figure>

      {/* Identity is never colour-alone, and a chart is never the only route to
          the data. */}
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
            Each newsroom&rsquo;s first publication, and the running count of
            independent newsrooms
          </caption>
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th scope="col" className="text-label py-1.5 text-[var(--foreground-subtle)]">#</th>
              <th scope="col" className="text-label py-1.5 text-[var(--foreground-subtle)]">Newsroom</th>
              <th scope="col" className="text-label py-1.5 text-[var(--foreground-subtle)]">First published</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => (
              <tr key={s.outlet} className="border-b border-[var(--border)] last:border-0">
                <td className="font-data py-1.5 text-[12px] tabular-nums text-[var(--foreground-subtle)]">
                  {s.count}
                </td>
                <td className="text-body-sm py-1.5 text-[var(--foreground)]">
                  {s.outlet}
                  {i === 0 && (
                    <span className="font-data ml-2 text-[11px] text-[var(--accent)]">broke it</span>
                  )}
                </td>
                <td className="font-data py-1.5 text-[12px] tabular-nums text-[var(--foreground-muted)]">
                  {s.at.toLocaleString('en-GB', { ...dateFmt, ...timeFmt })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
