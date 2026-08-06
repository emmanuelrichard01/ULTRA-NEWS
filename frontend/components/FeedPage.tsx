"use client";

import { useInfiniteQuery, useQuery, keepPreviousData } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import StoryCard from "@/components/StoryCard";
import StoryCardSkeleton from "@/components/StoryCardSkeleton";
import VelocityLeaderboard from "@/components/VelocityLeaderboard";
import CategoryPill from "@/components/CategoryPill";
import AskWireModal from "@/components/AskWireModal";
import EditionNav from "@/components/EditionNav";
import { fetchStories, fetchTrendingStories } from "@/lib/api";
import type { PaginatedResponse, StoryDetail } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import { CORROBORATION_FILTERS } from "@/lib/corroboration";
import type { Edition } from "@/lib/editions";
import { useInView } from "react-intersection-observer";
import { isToday, isYesterday, differenceInDays } from "date-fns";

/**
 * FeedPage — renders one edition.
 *
 * Editions are orderings of the whole corpus rather than slices of it (see
 * lib/editions.ts), so the same component serves all three and none can run
 * dry. The corroboration filter applies within whichever edition is open.
 *
 * **The first page is rendered on the server.** This component receives it as
 * `initialStories` and seeds React Query with it, so the HTML that reaches the
 * browser already contains the stories. It previously fetched everything
 * client-side, which meant a visitor waited for the document, then for the JS,
 * then for a second round trip to the API before seeing a single headline —
 * and because the shell could not be cached at the edge, none of those steps
 * were shared between visitors.
 *
 * Query params are read with `useSearchParams()` rather than taken as a prop.
 * Accepting the `searchParams` prop opts the whole route out of static
 * rendering; reading them here, under a Suspense boundary, keeps the shell
 * prerenderable and confines the dynamic part to this subtree.
 */

interface FeedPageProps {
  edition: Edition;
  /** Set on topic routes, which reuse The Wire's ordering within one category. */
  category?: string;
  titleOverride?: string;
  taglineOverride?: string;
  /** First page, fetched on the server so it ships inside the HTML. */
  initialStories?: PaginatedResponse<StoryDetail>;
}

const ALL_CATEGORIES = Object.entries(CATEGORY_MAP).map(([slug, info]) => ({
  slug,
  displayName: info.displayName,
}));

/** Date sentinels break the feed into scannable runs, as a broadsheet would. */
function groupStoriesByTime(stories: StoryDetail[]) {
  const groups: { sentinel: string; stories: StoryDetail[] }[] = [];
  let current = "";

  stories.forEach((story) => {
    const d = new Date(story.first_seen_at);
    let sentinel = "Earlier";
    if (isToday(d)) sentinel = "Today";
    else if (isYesterday(d)) sentinel = "Yesterday";
    else if (differenceInDays(new Date(), d) <= 7) sentinel = "This week";

    if (sentinel !== current) {
      groups.push({ sentinel, stories: [story] });
      current = sentinel;
    } else {
      groups[groups.length - 1].stories.push(story);
    }
  });
  return groups;
}

export default function FeedPage({
  edition,
  category,
  titleOverride,
  taglineOverride,
  initialStories,
}: FeedPageProps) {
  const searchParams = useSearchParams();
  const initialCursor = searchParams.get("cursor") ?? undefined;

  // ?sources=2|3 makes a filtered view linkable, and is where the retired
  // /reporting route now lands.
  const sourcesParam = Number(searchParams.get("sources"));
  const [minSources, setMinSources] = useState<number>(
    Number.isFinite(sourcesParam) && sourcesParam >= 1
      ? sourcesParam
      : edition.minSources ?? 1
  );

  const [activeCategory, setActiveCategory] = useState<string | undefined>(category);
  const [isAskOpen, setIsAskOpen] = useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status: queryStatus,
    isPlaceholderData,
  } = useInfiniteQuery({
    queryKey: ["stories", edition.slug, minSources, activeCategory],
    queryFn: ({ pageParam = initialCursor }) =>
      fetchStories({
        minSources,
        category: activeCategory,
        cursor: pageParam,
        sort: edition.sort,
      }),
    initialPageParam: initialCursor,
    getNextPageParam: (lastPage) => lastPage.next_cursor || undefined,
    placeholderData: keepPreviousData,
    // Seed from the server render so the first paint has real stories rather
    // than a skeleton. Only valid for the unfiltered first page: once a reader
    // changes the corroboration filter or topic, the server payload no longer
    // describes what they asked for, and reusing it would show the wrong rows.
    initialData:
      initialStories && !initialCursor && minSources === (edition.minSources ?? 1)
        ? { pages: [initialStories], pageParams: [undefined] }
        : undefined,
  });

  const { data: trending = [] } = useQuery({
    queryKey: ["trending", activeCategory],
    queryFn: () => fetchTrendingStories({ category: activeCategory }),
    enabled: edition.showLeaderboard,
    staleTime: 60_000,
  });

  const { ref, inView } = useInView({ rootMargin: "500px" });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsAskOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const stories: StoryDetail[] = data?.pages.flatMap((p) => p.items) ?? [];
  const totalCount = data?.pages[0]?.count ?? 0;

  const leadStory =
    edition.showLead && !initialCursor && stories.length > 0 ? stories[0] : null;
  const feedStories = leadStory ? stories.slice(1) : stories;

  // Momentum and significance are rankings, not chronologies — grouping them by
  // date would impose an order the edition deliberately doesn't use.
  const useTimeGroups = edition.sort === "latest";
  const groups = useTimeGroups ? groupStoriesByTime(feedStories) : null;

  const activeFilter =
    CORROBORATION_FILTERS.find((f) => f.minSources === minSources) ??
    CORROBORATION_FILTERS[0];

  return (
    <div className="mx-auto max-w-6xl">
      <EditionNav current={edition} />

      {/* ------------------------------------------------------- masthead */}
      <header className="mb-8 border-b-2 border-[var(--foreground)] pb-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-display-2xl font-display text-balance text-[var(--foreground)]">
              {titleOverride ?? edition.name}
            </h1>
            <p className="text-body-md measure mt-2 text-[var(--foreground-muted)]">
              {taglineOverride ?? edition.tagline}
            </p>
          </div>

          <button
            onClick={() => setIsAskOpen(true)}
            className="group flex shrink-0 items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 transition-colors hover:border-[var(--border-hover)]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[var(--foreground-muted)]" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <span className="text-body-sm text-[var(--foreground-muted)]">Ask the wire room</span>
            <kbd className="font-data rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] text-[var(--foreground-subtle)]">
              ⌘K
            </kbd>
          </button>
        </div>
      </header>

      <AskWireModal isOpen={isAskOpen} onClose={() => setIsAskOpen(false)} />

      {/* -------------------------------------------------------- controls */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div
            role="group"
            aria-label="Filter by corroboration level"
            className="inline-flex rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-1"
          >
            {CORROBORATION_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setMinSources(f.minSources)}
                aria-pressed={minSources === f.minSources}
                title={f.hint}
                className={`text-label rounded-[var(--radius-chip)] px-3 py-1.5 transition-colors ${
                  minSources === f.minSources
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <p className="text-body-sm text-[var(--foreground-subtle)]">{activeFilter.hint}</p>

          {/* The edition sets the ordering, so it's stated rather than offered
              as a control that would contradict the edition the reader chose. */}
          <p className="text-label ml-auto text-[var(--foreground-subtle)]">
            {edition.rubric}
          </p>
        </div>

        <nav aria-label="Filter by topic" className="pb-scrollbar flex items-center gap-1.5 overflow-x-auto">
          <CategoryPill
            label="All topics"
            size="sm"
            isActive={!activeCategory}
            onClick={() => setActiveCategory(undefined)}
          />
          {ALL_CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat.slug}
              label={cat.displayName}
              size="sm"
              isActive={activeCategory === cat.slug}
              onClick={() =>
                setActiveCategory(activeCategory === cat.slug ? undefined : cat.slug)
              }
            />
          ))}
        </nav>
      </div>

      {/* ---------------------------------------------------------- states */}
      {/*
        Keyed on absence of data rather than `status === "pending"`.
        Supplying `initialData` narrows the query's status type so "pending" is
        unreachable to the compiler — but it is still reachable at runtime, on
        the paths where no server payload applies: a changed corroboration
        filter, a different topic, a cursor page. Testing the data is true in
        both worlds.
      */}
      {!data && queryStatus !== "error" && (
        <div className="space-y-2">
          {edition.showLead && <StoryCardSkeleton variant="lead" />}
          {Array.from({ length: 5 }).map((_, i) => (
            <StoryCardSkeleton key={i} variant="standard" />
          ))}
        </div>
      )}

      {queryStatus === "error" && (
        <div className="rounded-[var(--radius-card)] border border-[var(--wire-red)]/30 bg-[var(--wire-red)]/5 p-8 text-center">
          <p className="text-display-sm font-display text-[var(--foreground)]">
            Couldn&rsquo;t reach the wire room
          </p>
          <p className="text-body-sm mt-2 text-[var(--foreground-muted)]">
            The story feed is temporarily unavailable. Refreshing usually fixes it.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------ feed */}
      {queryStatus === "success" && (
        <div className={`transition-opacity duration-200 ${isPlaceholderData ? "opacity-50" : "opacity-100"}`}>
          {stories.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-8 py-16 text-center">
              <p className="text-display-sm font-display text-[var(--foreground)]">
                Nothing here yet
              </p>
              <p className="text-body-sm mx-auto mt-2 max-w-md text-[var(--foreground-muted)]">
                {minSources > (edition.minSources ?? 1)
                  ? `No story has reached ${minSources} independent outlets${
                      activeCategory ? ` in ${activeCategory}` : ""
                    } yet. Try a lower threshold.`
                  : edition.emptyMessage}
              </p>
              {minSources > 1 && (
                <button
                  onClick={() => setMinSources(1)}
                  className="text-label mt-5 rounded-[var(--radius-chip)] border border-[var(--border)] px-3 py-2 text-[var(--foreground)] transition-colors hover:border-[var(--border-hover)]"
                >
                  Show all stories
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-12 lg:flex-row">
              <div className="min-w-0 flex-1">
                {leadStory && (
                  <div className="mb-10 border-b border-[var(--border)] pb-10">
                    <StoryCard variant="lead" priority {...cardProps(leadStory)} />
                  </div>
                )}

                {groups
                  ? groups.map((group) => (
                      <section key={group.sentinel} className="mb-10">
                        <h2 className="section-rule text-label mb-1 text-[var(--foreground-subtle)]">
                          {group.sentinel}
                        </h2>
                        {group.stories.map((story) => (
                          <StoryCard key={story.slug} variant="standard" {...cardProps(story)} />
                        ))}
                      </section>
                    ))
                  : feedStories.map((story, i) => (
                      <StoryCard
                        key={story.slug}
                        variant="standard"
                        rank={i + (leadStory ? 2 : 1)}
                        {...cardProps(story)}
                      />
                    ))}
              </div>

              {edition.showLeaderboard && trending.length > 0 && (
                <aside className="w-full shrink-0 self-start lg:sticky lg:top-20 lg:w-72 xl:w-80">
                  <VelocityLeaderboard stories={trending} />
                </aside>
              )}
            </div>
          )}

          <div ref={ref} className="flex h-20 items-center justify-center">
            {isFetchingNextPage ? (
              <span className="font-data text-[12px] text-[var(--foreground-subtle)]">
                Loading more…
              </span>
            ) : !hasNextPage && stories.length > 0 ? (
              <span className="text-label text-[var(--foreground-subtle)]">
                {edition.sort === "latest"
                  ? `End of feed · ${totalCount.toLocaleString()} stories`
                  : `${stories.length} stories in this edition`}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/** Map an API story onto StoryCard's props. */
function cardProps(story: StoryDetail) {
  return {
    title: story.title,
    slug: story.slug,
    imageUrl: story.image_url,
    excerpt: story.summary,
    publishedDate: story.first_seen_at,
    sourceCount: story.source_count,
    independentCount: story.independent_count,
    sources: story.sources,
    categories: story.categories,
    framingPreview: story.framing_preview,
    recentOutlets: story.recent_outlets,
  };
}
