"use client";

import { useState } from 'react';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';

import { groupByOutlet, mergedFeedCount } from '@/lib/outlets';
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

  /*
    Grouped by PUBLISHER, not by feed name.

    This filtered on `source.name`, which counted "BBC News" and "BBC World" as
    two independent confirmations of the same story. The heading then reported
    17 outlets directly beneath a masthead reading "Corroborated by 16" — the
    backend having grouped correctly on publisher domain. See lib/outlets.ts.
  */
  const outlets = groupByOutlet(articles);
  if (outlets.length === 0) return null;

  const mergedFeeds = mergedFeedCount(outlets);
  const origin = outlets[0].firstPublishedAt;
  const visible = expanded ? outlets : outlets.slice(0, 6);
  const hidden = outlets.length - visible.length;

  return (
    <section aria-labelledby="timeline-heading" className="border-t border-[var(--border)] py-12">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="timeline-heading" className="text-display-md font-display text-[var(--foreground)]">
          How this was corroborated
        </h2>
        <span className="font-data text-[12px] text-[var(--foreground-subtle)]">
          {outlets.length} independent {outlets.length === 1 ? 'newsroom' : 'newsrooms'}
        </span>
      </div>
      <p className="text-body-sm measure mb-8 mt-1.5 text-[var(--foreground-muted)]">
        Each newsroom the first time it published, in order, with the time
        elapsed since the story broke.
        {/*
          Stated rather than hidden. Merging two feeds into one row is the
          product's central rule enforcing itself, and showing the reader it
          happened is more convincing than a count that silently already
          accounts for it.
        */}
        {mergedFeeds > 0 && (
          <>
            {' '}
            <span className="text-[var(--foreground-subtle)]">
              {mergedFeeds === 1
                ? 'One feed is merged into its newsroom below — a newsroom cannot corroborate itself.'
                : `${mergedFeeds} feeds are merged into their newsrooms below — a newsroom cannot corroborate itself.`}
            </span>
          </>
        )}
      </p>

      <ol className="relative">
        {/* Spine */}
        <div
          className="absolute bottom-3 left-[7px] top-3 w-px bg-[var(--border)]"
          aria-hidden="true"
        />

        {visible.map((outlet, i) => {
          const article = outlet.first;
          const when = outlet.firstPublishedAt;
          const lag = differenceInMinutes(when, origin);
          const isFirst = i === 0;

          return (
            <li key={outlet.publisher} className="relative pb-7 pl-8 last:pb-0">
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
                  {outlet.name}
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

              {/* Names the merge on the row it happened, so a reader wondering
                  where "BBC World" went can see it was folded into the BBC. */}
              {outlet.feedNames.length > 1 && (
                <p className="font-data mt-1 text-[11px] text-[var(--foreground-subtle)]">
                  {outlet.feedNames.length} feeds from this newsroom, counted
                  once: {outlet.feedNames.join(' · ')}
                </p>
              )}

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
