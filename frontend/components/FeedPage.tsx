"use client";

import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { isToday, isYesterday, differenceInDays } from "date-fns";
import { useInView } from "react-intersection-observer";

import StoryCard from "@/components/StoryCard";
import StoryCardSkeleton from "@/components/StoryCardSkeleton";
import TopicFilter from "@/components/TopicFilter";
import LeadCarousel from "@/components/LeadCarousel";
import UnconfirmedPanel from "@/components/UnconfirmedPanel";
import AskWireModal from "@/components/AskWireModal";
import EditionBar from "@/components/EditionBar";
import MovingFastest from "@/components/MovingFastest";
import WireStatus from "@/components/WireStatus";
import { fetchStories } from "@/lib/api";
import type { PaginatedResponse, StoryDetail } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import { CORROBORATION_FILTERS } from "@/lib/corroboration";
import type { Edition } from "@/lib/editions";

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
 * The hero and the sidebar are server-fetched too, and passed in rather than
 * queried here, so the landing page arrives complete in one document.
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
  /**
   * The lead stories. Fetched separately for The Wire, whose own first row is
   * whatever landed most recently rather than anything a reader would lead
   * with.
   */
  leadStories?: StoryDetail[];
  /** Sidebar ranking, for the editions that carry one. */
  momentumStories?: StoryDetail[];
}

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
  leadStories: serverLeads = [],
  momentumStories = [],
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

  /**
   * Only the filters this edition can actually act on.
   *
   * Developing's query requires two independent outlets inside the momentum
   * window; The Record requires three overall. Offering "All stories —
   * everything on the wire, including single-source reports" on either was a
   * control describing a result the server will never return, and the reader
   * who selected it got the identical feed back with no explanation.
   */
  const availableFilters = CORROBORATION_FILTERS.filter(
    (f) => f.minSources >= edition.floorOutlets
  );
  const effectiveMinSources = Math.max(minSources, edition.floorOutlets);
  const isDefaultView =
    effectiveMinSources ===
      Math.max(edition.minSources ?? 1, edition.floorOutlets) &&
    activeCategory === category;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status: queryStatus,
    isPlaceholderData,
  } = useInfiniteQuery({
    queryKey: ["stories", edition.slug, effectiveMinSources, activeCategory],
    queryFn: ({ pageParam = initialCursor }) =>
      fetchStories({
        minSources: effectiveMinSources,
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
      initialStories && !initialCursor && isDefaultView
        ? { pages: [initialStories], pageParams: [undefined] }
        : undefined,
  });

  /**
   * Auto-load, but not forever.
   *
   * Unbounded infinite scroll made two things unreachable. The footer — which
   * carries the source list, the RSS feeds, the licence and the privacy and
   * terms pages — could not be reached at all, because a new page loaded every
   * time the reader approached the bottom. And the sticky sidebar was pinned
   * beside a column that never ended, so anything below its own fold stayed
   * below it.
   *
   * Two pages arrive on their own, which covers the reader who is browsing;
   * past that it takes a deliberate click. That is the pattern every publisher
   * that has measured this converges on, and it hands the end of the document
   * back to the reader.
   */
  const AUTO_PAGES = 2;
  const pagesLoaded = data?.pages.length ?? 0;
  const autoLoad = pagesLoaded < AUTO_PAGES;

  const { ref, inView } = useInView({ rootMargin: "600px" });

  useEffect(() => {
    if (autoLoad && inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [autoLoad, inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

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

  /**
   * The lead slot.
   *
   * Two sources, because the two editions that lead are answering different
   * questions. The Record ranks by weight of evidence, so its best story is
   * already row one and the lead is that row promoted. The Wire ranks by
   * recency, so its row one is whatever landed last — on a corpus that is
   * overwhelmingly single-source, usually one outlet's unconfirmed report. Its
   * leads are fetched separately as the most recent stories another newsroom
   * has confirmed (see fetchLeadStories), which is the call a wire editor
   * makes.
   *
   * Suppressed once the reader filters or paginates: a lead selected under the
   * default view is not an answer to the question they just asked.
   */
  const leadStories: StoryDetail[] =
    !edition.showLead || !isDefaultView || initialCursor
      ? []
      : serverLeads.length > 0
      ? serverLeads
      : stories.slice(0, 1);

  // Matched by slug rather than by position. The Record's lead is row one and
  // slicing would do; The Wire's arrive from a separate query and sit at
  // whatever chronological positions they belong to, so a positional slice
  // would drop unrelated stories and leave the leads printed twice on one page.
  const leadSlugs = new Set(leadStories.map((s) => s.slug));
  const feedStories =
    leadSlugs.size > 0
      ? stories.filter((s) => !leadSlugs.has(s.slug))
      : stories;

  // Momentum and significance are rankings, not chronologies — grouping them by
  // date would impose an order the edition deliberately doesn't use.
  const useTimeGroups = edition.sort === "latest";
  const groups = useTimeGroups ? groupStoriesByTime(feedStories) : null;

  const activeFilter =
    availableFilters.find((f) => f.minSources === effectiveMinSources) ??
    availableFilters[0];

  /**
   * One sentence saying what you are looking at.
   *
   * Ordering first, because that is what distinguishes the editions; then what
   * the filter is doing, because that is what the reader last changed. These
   * were previously two fragments at opposite ends of a control row — the
   * rubric right-aligned at 11px in tertiary grey, the filter hint left-aligned
   * in another size — so the single most orienting sentence on the page was
   * split in half and set in the quietest type available.
   */
  const orientation = [
    taglineOverride ?? edition.tagline,
    activeFilter && effectiveMinSources > edition.floorOutlets
      ? activeFilter.hint
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const showFilters = availableFilters.length > 1;
  const showSidebar = edition.showSidebar && !titleOverride;

  /**
   * The unconfirmed column, drawn from the feed already on the page.
   *
   * No extra request: The Wire's first page is ordered by recency and is
   * overwhelmingly single-source, so the stories this panel wants are the ones
   * already loaded. It is also only meaningful where single-source stories can
   * appear at all — Developing and The Record both enforce a floor above one,
   * so there is nothing for it to show there.
   */
  const unconfirmedStories = stories.filter((s) => s.independent_count <= 1);
  const showUnconfirmed =
    edition.showUnconfirmed && isDefaultView && unconfirmedStories.length >= 3;

  const feedColumn = (
    <div className="min-w-0 flex-1">
      {/*
        The lead block: what has been confirmed, beside what has not.

        The pairing is the argument. On the left, the most recent reporting a
        second newsroom has stood up; on the right, the most recent reporting
        nobody has. Same wire, same hour, split by the only question this
        product exists to answer — so a first-time visitor sees what Ultra News
        is before reading a line of explanation.

        Side by side from xl, stacked below it: at narrower widths the panel
        would squeeze the hero's overlaid headline into a column too narrow to
        set display type in.
      */}
      {leadStories.length > 0 && (
        <div
          className={`mb-8 border-b border-[var(--border)] pb-8 ${
            showUnconfirmed ? 'grid gap-6 xl:grid-cols-[1fr_17rem]' : ''
          }`}
        >
          <LeadCarousel
            stories={leadStories}
            kicker={edition.leadKicker}
            timeField={edition.timeField}
            timePrefix={edition.timePrefix}
            // Without the companion panel the lead has the whole column, and
            // needs a wider crop to stay a picture rather than a wall.
            layout={showUnconfirmed ? 'column' : 'wide'}
          />

          {/*
            The panel matches the hero's height rather than setting its own.

            A grid row is as tall as its tallest item, so with both in normal
            flow whichever had more content won — and it was the panel, leaving
            the hero's column short and a bordered card hanging 30-odd pixels
            below it. Taking the panel out of flow at xl (absolute inside a
            stretched cell) means it contributes no height: the hero sizes the
            row, and the panel fills exactly that. Below xl the two stack, so
            the child returns to normal flow and sizes itself.
          */}
          {showUnconfirmed && (
            <div className="relative">
              <div className="xl:absolute xl:inset-0">
                <UnconfirmedPanel stories={unconfirmedStories} />
              </div>
            </div>
          )}
        </div>
      )}

      {groups ? (
        groups.map((group) => (
          <section key={group.sentinel} className="mb-8">
            {/*
              The date sentinel sticks while its own run is on screen.

              A chronological feed loses its footing quickly: forty rows in,
              "12h ago" on a card no longer tells you what day you are reading,
              and the heading that did say so scrolled off long before. Sticking
              it keeps the answer on screen for exactly as long as it is true.

              Offset to clear the site header, which is itself sticky at h-14.
            */}
            <h2 className="section-rule text-label sticky top-14 z-20 -mx-2 mb-1 bg-[var(--background)]/95 px-2 py-2 text-[var(--foreground-subtle)] backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/80">
              {group.sentinel}
            </h2>
            {group.stories.map((story) => (
              <StoryCard
                key={story.slug}
                variant="standard"
                {...cardProps(story, edition)}
              />
            ))}
          </section>
        ))
      ) : (
        feedStories.map((story, i) => (
          <StoryCard
            key={story.slug}
            variant="standard"
            // The leads hold the top positions in a ranked edition, so the
            // list beneath them starts after however many were promoted.
            rank={edition.showRanks ? i + 1 + leadStories.length : undefined}
            {...cardProps(story, edition)}
          />
        ))
      )}
    </div>
  );

  return (
    <div className={`mx-auto ${showSidebar ? "max-w-6xl" : "max-w-5xl"}`}>
      <EditionBar
        current={edition}
        titleOverride={titleOverride}
        orientation={orientation}
        status={
          edition.showStatus && stories.length > 0 ? (
            <WireStatus stories={stories} totalCount={totalCount} />
          ) : null
        }
        onAsk={() => setIsAskOpen(true)}
      />

      <AskWireModal isOpen={isAskOpen} onClose={() => setIsAskOpen(false)} />

      {/* --------------------------------------------------------- controls
        One row, and every control on it names what it does.

        This was two stacked bands: a three-way segment reading "All stories |
        2+ outlets | 3+ outlets" with no label saying what was being counted,
        above a scrolling row of ten topic chips. Seventeen controls in four
        bands stood between a first-time visitor and the first headline, and the
        one that mattered most was unlabelled jargon — "2+ outlets" means
        nothing until you already know the product measures corroboration in
        independent publishers.

        So the segment gets a visible legend, and the ten topic chips collapse
        into one control that states its own value.
      */}
      {/* Justified apart only when there are two groups. The Record offers no
          corroboration filter — everything in it already clears three outlets —
          and an empty spacer there left the topic control stranded alone
          against the right margin with a screen's width of nothing beside it. */}
      <div
        className={`mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 ${
          showFilters ? "justify-between" : "justify-start"
        }`}
      >
        {showFilters ? (
          <div className="flex items-center gap-3">
            <span
              id="corroboration-legend"
              className="text-label hidden text-[var(--foreground-subtle)] sm:block"
            >
              Corroboration
            </span>
            <div
              role="group"
              aria-labelledby="corroboration-legend"
              aria-label="Filter by corroboration level"
              className="inline-flex rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-1"
            >
              {availableFilters.map((f) => {
                const isActive = effectiveMinSources === f.minSources;
                return (
                  <button
                    key={f.id}
                    onClick={() => setMinSources(f.minSources)}
                    aria-pressed={isActive}
                    title={f.hint}
                    className={`text-label flex items-center gap-2 rounded-[var(--radius-chip)] px-3 py-1.5 transition-colors ${
                      isActive
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {/*
                      A miniature of the meter that appears on every card.

                      "2+ outlets" is jargon until you have connected it to the
                      bars beside each headline, and nothing on the page made
                      that connection — the filter and the signal it filters on
                      were drawn in two different vocabularies. Three rising
                      ticks here are the same three rising ticks there.
                    */}
                    <span className="flex items-end gap-[2px]" aria-hidden="true">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-[2px] rounded-[1px] transition-colors"
                          style={{
                            height: `${5 + i * 2}px`,
                            backgroundColor:
                              i < f.minSources
                                ? isActive
                                  ? "var(--background)"
                                  : "var(--foreground-muted)"
                                : isActive
                                ? "color-mix(in srgb, var(--background) 35%, transparent)"
                                : "var(--border-strong)",
                          }}
                        />
                      ))}
                    </span>
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <TopicFilter active={activeCategory} onChange={setActiveCategory} />
      </div>

      {/*
        Refetch indicator.

        This replaces dropping the whole feed to 50% opacity while a filter
        change was in flight — a page-wide dimming for what is usually a
        sub-200ms request, which read as an error state and made the stories
        already on screen briefly unreadable on their way to being correct.
      */}
      <div className="mb-px h-px" aria-hidden={!isPlaceholderData}>
        {isPlaceholderData && <div className="progress-hairline" />}
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
        <div>
          {edition.showLead && <StoryCardSkeleton variant="lead" />}
          {Array.from({ length: 6 }).map((_, i) => (
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
        <div>
          {stories.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-8 py-16 text-center">
              <p className="text-display-sm font-display text-[var(--foreground)]">
                Nothing here yet
              </p>
              <p className="text-body-sm mx-auto mt-2 max-w-md text-[var(--foreground-muted)]">
                {effectiveMinSources > edition.floorOutlets
                  ? `No story has reached ${effectiveMinSources} independent outlets${
                      activeCategory
                        ? ` in ${CATEGORY_MAP[activeCategory]?.displayName ?? activeCategory}`
                        : ""
                    } yet. Try a lower threshold.`
                  : edition.emptyMessage}
              </p>
              {effectiveMinSources > edition.floorOutlets && (
                <button
                  onClick={() => setMinSources(edition.floorOutlets)}
                  className="text-label mt-5 rounded-[var(--radius-chip)] border border-[var(--border)] px-3 py-2 text-[var(--foreground)] transition-colors hover:border-[var(--border-hover)]"
                >
                  {availableFilters[0].label}
                </button>
              )}
            </div>
          ) : showSidebar ? (
            <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
              {feedColumn}
              {/*
                Sticky, and bounded by the viewport it is stuck to.

                Without the max-height a panel taller than the screen has its
                lower half permanently out of reach: it is pinned beside a
                column that keeps going, so scrolling the page never scrolls
                the panel. `max-h` plus its own overflow lets the reader reach
                the bottom of the ranking and the "all developing" link under
                it, which was the point of the panel.
              */}
              <aside className="scroll-slim w-full shrink-0 self-start lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:w-[var(--sidebar-width)]">
                <MovingFastest stories={momentumStories} />
              </aside>
            </div>
          ) : (
            feedColumn
          )}

          <div
            ref={ref}
            className="flex flex-col items-center justify-center gap-3 py-10"
          >
            {isFetchingNextPage ? (
              <span className="font-data text-[12px] text-[var(--foreground-subtle)]">
                Loading more…
              </span>
            ) : hasNextPage ? (
              <>
                <button
                  onClick={() => fetchNextPage()}
                  className="text-label rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-[var(--foreground)] transition-colors hover:border-[var(--border-hover)]"
                >
                  Load more stories
                </button>
                <span className="font-data text-[11px] tabular-nums text-[var(--foreground-subtle)]">
                  {stories.length} of {totalCount.toLocaleString()}
                </span>
              </>
            ) : stories.length > 0 ? (
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

/** Map an API story onto StoryCard's props, in this edition's terms. */
function cardProps(story: StoryDetail, edition: Edition) {
  return {
    title: story.title,
    slug: story.slug,
    imageUrl: story.image_url,
    excerpt: story.summary,
    // Which clock this edition wants the reader watching — see lib/editions.ts.
    timestamp:
      edition.timeField === "last_updated_at"
        ? story.last_updated_at
        : story.first_seen_at,
    timestampPrefix: edition.timePrefix,
    sourceCount: story.source_count,
    independentCount: story.independent_count,
    sources: story.sources,
    categories: story.categories,
    framingPreview: story.framing_preview,
    recentOutlets: story.recent_outlets,
    showImage: edition.showImages,
  };
}
