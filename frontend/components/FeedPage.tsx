"use client";

import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { use, useEffect, useState } from "react";
import StoryCard from "@/components/StoryCard";
import StoryCardSkeleton from "@/components/StoryCardSkeleton";
import VelocityLeaderboard from "@/components/VelocityLeaderboard";
import CategoryPill from "@/components/CategoryPill";
import AskWireModal from "@/components/AskWireModal";
import { fetchStories } from "@/lib/api";
import type { StoryDetail } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import { useInView } from "react-intersection-observer";
import { isToday, isYesterday, differenceInDays } from "date-fns";

interface FeedPageProps {
  title: string;
  subtitle: string;
  status?: string;
  category?: string;
  accentColor: string;
  pingColor: string;
  showVelocityLeaderboard: boolean;
  showHero: boolean;
  emptyMessage: string;
  basePath: string;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const ALL_CATEGORIES = Object.entries(CATEGORY_MAP).map(([slug, info]) => ({
  slug,
  displayName: info.displayName,
}));

// Helper to inject temporal sentinels into the feed stream
function groupStoriesByTime(stories: StoryDetail[]) {
  const groups: { sentinel: string; stories: StoryDetail[] }[] = [];
  let currentSentinel = "";

  stories.forEach((story) => {
    const d = new Date(story.first_seen_at);
    let sentinel = "Older";
    if (isToday(d)) {
      sentinel = "Today";
    } else if (isYesterday(d)) {
      sentinel = "Yesterday";
    } else {
      const days = differenceInDays(new Date(), d);
      if (days <= 7) sentinel = "Last 7 Days";
    }

    if (sentinel !== currentSentinel) {
      groups.push({ sentinel, stories: [story] });
      currentSentinel = sentinel;
    } else {
      groups[groups.length - 1].stories.push(story);
    }
  });
  return groups;
}

export default function FeedPage({
  title,
  subtitle,
  status,
  category: initialCategory,
  accentColor,
  pingColor,
  showVelocityLeaderboard,
  showHero,
  emptyMessage,
  searchParams,
}: FeedPageProps) {
  const resolvedParams = use(searchParams);
  const initialCursor = typeof resolvedParams?.cursor === "string" ? resolvedParams.cursor : undefined;
  const [activeCategory, setActiveCategory] = useState<string | undefined>(initialCategory);
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status: queryStatus,
    isPlaceholderData,
  } = useInfiniteQuery({
    queryKey: ["stories", status, activeCategory],
    queryFn: async ({ pageParam = initialCursor }) => {
      return fetchStories({ status, category: activeCategory, cursor: pageParam });
    },
    initialPageParam: initialCursor,
    getNextPageParam: (lastPage) => lastPage.next_cursor || undefined,
    placeholderData: keepPreviousData, // Zero-CLS category switching!
  });

  const { ref, inView } = useInView();

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Global hotkey for Ask Wire RAG
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsAskModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const stories: StoryDetail[] = data?.pages.flatMap((page) => page.items) || [];
  const heroStory = showHero && !initialCursor && !activeCategory && stories.length > 0 ? stories[0] : null;
  const feedStories = heroStory ? stories.slice(1) : stories;
  
  // Create temporal groups
  const temporalGroups = groupStoriesByTime(feedStories);

  // Derive metrics for the intelligence bar
  const totalStories = data?.pages[0]?.count || 0;
  
  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <header className="border-b-2 border-[var(--foreground)] pb-6 relative overflow-hidden flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-display-xl font-display text-[var(--foreground)] relative z-10 flex items-center gap-4">
            {title}
            <span className="relative flex h-3 w-3">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: `var(${pingColor})` }}
              />
              <span
                className="relative inline-flex rounded-full h-3 w-3"
                style={{ backgroundColor: `var(${pingColor})` }}
              />
            </span>
          </h1>
          <p className="text-body-md text-[var(--foreground-muted)] mt-2 relative z-10 max-w-2xl">
            {subtitle}
          </p>
        </div>

        {/* Intelligence Metrics Bar */}
        <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
          <div className="flex flex-col bg-[var(--surface-elevated)] border border-[var(--border)] px-4 py-2 rounded-[var(--radius-card)]">
            <span className="font-data text-[9px] text-[var(--foreground-muted)] uppercase tracking-widest mb-0.5">Clustered Today</span>
            <span className="font-data text-lg font-bold text-[var(--foreground)]">{totalStories > 0 ? totalStories.toLocaleString() : "..."}</span>
          </div>
          
          <button
            onClick={() => setIsAskModalOpen(true)}
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-[var(--radius-card)] bg-[var(--surface-elevated)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--foreground)] font-data text-xs font-semibold transition-all group shadow-sm"
            title="Press ⌘K to open"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)] group-hover:scale-110 transition-transform"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            Ask Wire RAG <span className="opacity-40 font-mono text-[10px] ml-1 border border-[var(--foreground-muted)] rounded-sm px-1 py-0.5">⌘K</span>
          </button>
        </div>
      </header>

      {/* Ask Wire RAG Modal */}
      <AskWireModal isOpen={isAskModalOpen} onClose={() => setIsAskModalOpen(false)} />

      {/* Category filter bar */}
      <nav className="flex items-center gap-2 overflow-x-auto pb-2 pb-scrollbar -mx-1 px-1">
        <button onClick={() => setActiveCategory(undefined)}>
          <CategoryPill
            label="All"
            isActive={!activeCategory}
            size="sm"
          />
        </button>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => setActiveCategory(activeCategory === cat.slug ? undefined : cat.slug)}
          >
            <CategoryPill
              label={cat.displayName}
              isActive={activeCategory === cat.slug}
              size="sm"
            />
          </button>
        ))}
      </nav>

      {/* Skeleton Loading State (Only for initial full page load, not category switching) */}
      {queryStatus === "pending" && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {showHero && <StoryCardSkeleton variant="hero" />}
          {Array.from({ length: 5 }).map((_, i) => (
            <StoryCardSkeleton key={i} variant="standard" />
          ))}
        </div>
      )}

      {/* Error state */}
      {queryStatus === "error" && (
        <div className="py-20 text-center text-[var(--wire-red)] font-data bg-[var(--surface-elevated)] rounded-[var(--radius-card)] border border-[var(--wire-red)]/20 p-8 max-w-4xl mx-auto">
          Error establishing connection to the wire room. Please try refreshing.
        </div>
      )}

      <div className={`transition-opacity duration-300 ${isPlaceholderData ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
        {/* Velocity Leaderboard */}
        {queryStatus === "success" && showVelocityLeaderboard && !initialCursor && !activeCategory && stories.length > 0 && (
          <section className="mb-12 max-w-4xl mx-auto">
            <VelocityLeaderboard stories={stories} />
          </section>
        )}

        {/* Hero Story */}
        {queryStatus === "success" && heroStory && (
          <section className="mb-12 max-w-4xl mx-auto">
            <StoryCard
              title={heroStory.title}
              slug={heroStory.slug}
              imageUrl={heroStory.image_url}
              excerpt={heroStory.summary}
              publishedDate={heroStory.first_seen_at}
              sourceCount={heroStory.source_count}
              independentCount={heroStory.independent_count}
              status={heroStory.status}
              sources={heroStory.sources}
              storySlug={heroStory.slug}
              categories={heroStory.categories}
              framingPreview={heroStory.framing_preview}
              velocityScore={heroStory.velocity_score}
              variant="hero"
            />
          </section>
        )}

        {/* Editorial Masonry/Split Grid Feed */}
        {queryStatus === "success" && temporalGroups.length > 0 && (
          <div className="flex flex-col lg:flex-row gap-10">
            {/* Primary Feed Column */}
            <div className="flex-1 max-w-4xl space-y-10">
              {temporalGroups.map((group) => (
                <section key={group.sentinel}>
                  {/* Temporal Sentinel */}
                  <div className="flex items-center gap-4 mb-6">
                    <span className="font-data text-[11px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] whitespace-nowrap bg-[var(--background)] pr-4">
                      {group.sentinel}
                    </span>
                    <div className="h-px w-full bg-[var(--border)]" />
                  </div>
                  
                  {/* Grid layout for stories */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-12">
                    {group.stories.map((story) => (
                      <StoryCard
                        key={story.slug}
                        title={story.title}
                        slug={story.slug}
                        imageUrl={story.image_url}
                        excerpt={story.summary}
                        publishedDate={story.first_seen_at}
                        sourceCount={story.source_count}
                        independentCount={story.independent_count}
                        status={story.status}
                        sources={story.sources}
                        storySlug={story.slug}
                        categories={story.categories}
                        framingPreview={story.framing_preview}
                        velocityScore={story.velocity_score}
                        variant="standard"
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Sidebar Column (Visible only on lg+ screens) */}
            <aside className="hidden lg:block w-80 shrink-0 border-l border-[var(--border)] pl-10 space-y-8 self-start sticky top-24">
               {/* Sidebar content could go here in the future: Top Sources, Live Ticker, Trending Topics */}
               <div className="p-6 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-card)]">
                 <h3 className="font-data text-xs font-bold uppercase tracking-widest text-[var(--foreground)] mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                    Intelligence Brief
                 </h3>
                 <p className="font-serif text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
                   Ultra News synthesizes thousands of raw articles into corroborated story clusters. Use the Interactive Framing Matrix on each card to see how different outlets headline the same event.
                 </p>
                 <button
                    onClick={() => setIsAskModalOpen(true)}
                    className="w-full text-center py-2.5 rounded-[var(--radius-chip)] bg-transparent border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white font-data text-[10px] uppercase font-bold tracking-widest transition-colors"
                  >
                    Consult the Wire Room
                 </button>
               </div>
            </aside>
          </div>
        )}

        {/* Empty State */}
        {queryStatus === "success" && stories.length === 0 && (
          <div className="py-16 text-center text-[var(--foreground-muted)] font-data bg-[var(--surface-elevated)] rounded-[var(--radius-card)] border border-[var(--border)] p-8 max-w-4xl mx-auto">
            {activeCategory ? `No stories in the '${activeCategory}' category currently.` : emptyMessage}
          </div>
        )}

        {/* Infinite Scroll Sentinel */}
        {queryStatus === "success" && (
          <div ref={ref} className="h-24 flex items-center justify-center pt-8 max-w-4xl mx-auto">
            {isFetchingNextPage ? (
              <div className="flex items-center gap-3 font-data text-xs text-[var(--foreground-muted)]">
                <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                Loading older stories...
              </div>
            ) : hasNextPage ? (
              <span className="font-data text-xs text-[var(--foreground-muted)] opacity-70 uppercase tracking-widest">Scroll to time travel</span>
            ) : stories.length > 0 ? (
              <span className="font-data text-[10px] text-[var(--foreground-muted)] opacity-40 uppercase tracking-[0.3em]">End of Archive</span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
