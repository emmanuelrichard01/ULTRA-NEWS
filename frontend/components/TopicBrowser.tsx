"use client";

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { StoryTile } from './cards';
import { fetchStories } from '@/lib/api';
import { CATEGORY_MAP, type StoryDetail } from '@/lib/types';
import { ArrowRight } from '@/components/icons';

/**
 * Browse by topic — the "Curated editorials" block from the reference layouts.
 *
 * A list of beats on the left, set large in the serif, with the selected one
 * marked; four stories from that beat on the right. It exists because the
 * front page is otherwise one chronological run, and a reader who cares about
 * Science has to scroll past everything else to learn whether anything
 * happened there today.
 *
 * Interaction, in the order it matters:
 *   - Hovering (or focusing) a topic PREFETCHES it, so by the time the click
 *     lands the stories are usually already in the cache and the switch is
 *     instant. Nine topics, four stories each, at most one request per topic
 *     per minute — cheaper than the round trip it hides.
 *   - The grid is keyed on the topic, so a switch replays the staggered
 *     entrance rather than swapping text under a static frame.
 *   - The previous topic's stories stay up while the next loads
 *     (`placeholderData`), dimmed slightly, rather than collapsing to a
 *     skeleton for what is typically a 100ms fetch.
 *
 * The first topic's stories arrive server-rendered, so the block is complete
 * in the initial HTML.
 */

const TOPICS = Object.values(CATEGORY_MAP);
const PER_TOPIC = 4;

function topicQuery(slug: string) {
  return {
    queryKey: ['topic-browser', slug],
    queryFn: () => fetchStories({ category: slug, limit: PER_TOPIC, sort: 'latest' as const }),
    staleTime: 60_000,
  };
}

export default function TopicBrowser({
  initialTopic,
  initialStories,
}: {
  initialTopic: string;
  initialStories: StoryDetail[];
}) {
  const [active, setActive] = useState(initialTopic);
  const queryClient = useQueryClient();

  const { data, isPlaceholderData } = useQuery({
    ...topicQuery(active),
    initialData:
      active === initialTopic && initialStories.length > 0
        ? { items: initialStories, count: initialStories.length }
        : undefined,
    placeholderData: (previous) => previous,
  });

  const stories = data?.items ?? [];
  const topic = CATEGORY_MAP[active];

  const prefetch = (slug: string) => queryClient.prefetchQuery(topicQuery(slug));

  return (
    <section aria-labelledby="topics-heading" className="reveal border-t border-[var(--border)] pt-12">
      <div className="grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-14">
        {/* min-w-0 on both grid items: a grid item's minimum width is its content's,
            so the scrolling row of topic pills on mobile widened the whole page. */}
        <div className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
          <p className="eyebrow mb-3">Browse by topic</p>
          <h2 id="topics-heading" className="text-display-xl font-display text-[var(--foreground)]">
            Every beat, counted
          </h2>

          <div
            role="tablist"
            aria-label="Topics"
            aria-orientation="vertical"
            className="pb-scrollbar -mx-4 mt-8 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:block lg:overflow-visible lg:px-0"
          >
            {TOPICS.map((t) => {
              const selected = t.slug === active;
              return (
                <button
                  key={t.slug}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls="topic-panel"
                  onClick={() => setActive(t.slug)}
                  onMouseEnter={() => prefetch(t.slug)}
                  onFocus={() => prefetch(t.slug)}
                  className={`topic-row font-display shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] border px-3.5 py-1.5 text-[18px] leading-tight lg:block lg:w-full lg:rounded-none lg:border-0 lg:border-b lg:border-[var(--border)] lg:px-0 lg:py-3 lg:text-left lg:text-[26px] ${
                    selected
                      ? 'border-[var(--foreground)] text-[var(--foreground)]'
                      : 'border-[var(--border)] text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]'
                  }`}
                >
                  {t.displayName}
                </button>
              );
            })}
          </div>

          <Link href={`/${active}`} className="pill pill-solid group mt-8 hidden lg:inline-flex">
            All {topic?.displayName ?? 'stories'}
            <ArrowRight className="nudge-arrow" />
          </Link>
        </div>

        <div
          id="topic-panel"
          role="tabpanel"
          aria-label={topic?.displayName}
          className={`min-w-0 transition-opacity duration-300 ${isPlaceholderData ? 'opacity-60' : 'opacity-100'}`}
        >
          {topic && (
            <p className="text-body-md mb-6 max-w-xl text-[var(--foreground-muted)]">
              {topic.description}
            </p>
          )}

          {stories.length > 0 ? (
            <div key={active} className="stagger grid gap-x-6 gap-y-10 sm:grid-cols-2">
              {stories.map((story, i) => (
                <StoryTile
                  key={story.slug}
                  story={story}
                  aspect={i === 0 ? 'aspect-[4/3]' : 'aspect-[16/10]'}
                  showExcerpt={i < 2}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] px-6 py-14 text-center">
              <p className="font-display text-[26px] text-[var(--foreground)]">Quiet on this beat</p>
              <p className="text-body-sm mt-2 text-[var(--foreground-muted)]">
                Nothing new in {topic?.displayName ?? 'this topic'} yet. Stories appear as outlets file them.
              </p>
            </div>
          )}

          <Link href={`/${active}`} className="pill pill-outline group mt-8 lg:hidden">
            All {topic?.displayName ?? 'stories'}
            <ArrowRight className="nudge-arrow" />
          </Link>
        </div>
      </div>
    </section>
  );
}
