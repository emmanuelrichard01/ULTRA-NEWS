"use client";

import { useState } from 'react';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';

import type { StoryArticle } from '@/lib/types';

/**
 * CorroborationTimeline — the story page's centrepiece.
 *
 * This is the one thing the product knows that a reader cannot get anywhere
 * else: not just that six outlets covered an event, but WHO broke it, HOW LONG
 * each took to follow, and WHAT each one chose to say. It answers "should I
 * believe this yet?" — which is the question the whole product exists for.
 *
 * The previous version drew a step-chart of cumulative article count against
 * time. It looked analytical but answered nothing: readers don't have a question
 * shaped like "how many articles existed at 14:20". Worse, it plotted articles
 * rather than publishers, so one outlet filing three updates looked identical to
 * three newsrooms independently confirming.
 *
 * Here each row is a PUBLISHER joining the story, in order, with the lag from
 * the first report and their own headline. The elapsed gaps are the analysis.
 */

interface CorroborationTimelineProps {
  articles: StoryArticle[];
}

function formatLag(minutes: number): string {
  if (minutes < 1) return 'moments later';
  if (minutes < 60) return `+${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem ? `+${hours}h ${rem}m` : `+${hours}h`;
  const days = Math.floor(hours / 24);
  return `+${days}d ${hours % 24}h`;
}

export default function CorroborationTimeline({ articles }: CorroborationTimelineProps) {
  const [expanded, setExpanded] = useState(false);

  const sorted = [...articles].sort(
    (a, b) => new Date(a.published_date).getTime() - new Date(b.published_date).getTime()
  );
  if (sorted.length === 0) return null;

  // One entry per outlet — the first time each published. A newsroom filing
  // three updates is one corroboration, not three.
  const seen = new Set<string>();
  const firstByOutlet = sorted.filter((a) => {
    if (seen.has(a.source.name)) return false;
    seen.add(a.source.name);
    return true;
  });

  const origin = new Date(firstByOutlet[0].published_date);
  const visible = expanded ? firstByOutlet : firstByOutlet.slice(0, 6);
  const hidden = firstByOutlet.length - visible.length;

  return (
    <section aria-labelledby="timeline-heading" className="border-t border-[var(--border)] py-12">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="timeline-heading" className="text-display-md font-display text-[var(--foreground)]">
          How this was corroborated
        </h2>
        <span className="font-data text-[12px] text-[var(--foreground-subtle)]">
          {firstByOutlet.length} independent {firstByOutlet.length === 1 ? 'outlet' : 'outlets'}
        </span>
      </div>
      <p className="text-body-sm measure mb-8 mt-1.5 text-[var(--foreground-muted)]">
        Each outlet the first time it published, in order, with the time elapsed
        since the story broke.
      </p>

      <ol className="relative">
        {/* Spine */}
        <div
          className="absolute bottom-3 left-[7px] top-3 w-px bg-[var(--border)]"
          aria-hidden="true"
        />

        {visible.map((article, i) => {
          const when = new Date(article.published_date);
          const lag = differenceInMinutes(when, origin);
          const isFirst = i === 0;

          return (
            <li key={article.slug ?? `${article.source.name}-${i}`} className="relative pb-7 pl-8 last:pb-0">
              {/* Node */}
              <span
                className={`absolute left-0 top-[5px] flex h-[15px] w-[15px] items-center justify-center rounded-full border-2 ${
                  isFirst
                    ? 'border-[var(--accent)] bg-[var(--accent)]'
                    : 'border-[var(--border-strong)] bg-[var(--background)]'
                }`}
                aria-hidden="true"
              />

              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-data text-[13px] font-semibold text-[var(--foreground)]">
                  {article.source.name}
                </span>
                {isFirst ? (
                  <span className="text-label rounded-[var(--radius-chip)] bg-[var(--accent)]/10 px-1.5 py-[2px] text-[var(--accent)]">
                    Broke it
                  </span>
                ) : (
                  <span className="font-data text-[12px] tabular-nums text-[var(--foreground-subtle)]">
                    {formatLag(lag)}
                  </span>
                )}
                <time
                  dateTime={when.toISOString()}
                  className="font-data text-[12px] text-[var(--foreground-subtle)]"
                >
                  {formatDistanceToNow(when, { addSuffix: true })}
                </time>
              </div>

              <h3 className="text-body-md mt-1.5 font-display leading-snug text-[var(--foreground)]">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-[var(--accent)]"
                >
                  {article.title}
                </a>
              </h3>

              {article.excerpt && (
                <p className="text-body-sm measure mt-1.5 line-clamp-2 text-[var(--foreground-muted)]">
                  {article.excerpt}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="text-label mt-2 ml-8 rounded-[var(--radius-chip)] border border-[var(--border)] px-3 py-2 text-[var(--foreground-muted)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--foreground)]"
        >
          Show {hidden} more {hidden === 1 ? 'outlet' : 'outlets'}
        </button>
      )}
    </section>
  );
}
