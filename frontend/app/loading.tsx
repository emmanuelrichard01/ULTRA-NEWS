import StoryCardSkeleton from '@/components/StoryCardSkeleton';

/**
 * Route-level loading state.
 *
 * Shaped like the feed it replaces so the page doesn't reflow when content
 * arrives, and marked aria-busy so assistive tech announces the wait rather
 * than reading out placeholder geometry.
 *
 * The container width and the header block above the cards both mirror
 * FeedPage/EditionBar. When they drifted — this still stood in a max-w-6xl
 * wrapper with a 48px display heading and a 2px rule under it — the skeleton
 * was a picture of the previous design, and the page visibly jumped sideways
 * and upward at the moment the real feed replaced it.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading stories…</span>

      {/* Edition bar: tabs rule, then the orientation line. */}
      <div className="mb-6">
        <div className="flex items-end justify-between gap-4 border-b border-[var(--border)] pb-3">
          <div className="skeleton h-6 w-64 rounded" />
          <div className="skeleton h-9 w-44 rounded-[var(--radius-card)]" />
        </div>
        <div className="skeleton mt-3 h-4 w-full max-w-lg rounded" />
      </div>

      {/* Controls: corroboration segment, then topics. */}
      <div className="mb-6 space-y-3">
        <div className="skeleton h-9 w-72 rounded-[var(--radius-card)]" />
        <div className="skeleton h-7 w-full max-w-2xl rounded" />
      </div>

      <StoryCardSkeleton variant="lead" />
      {Array.from({ length: 5 }).map((_, i) => (
        <StoryCardSkeleton key={i} variant="standard" />
      ))}
    </div>
  );
}
