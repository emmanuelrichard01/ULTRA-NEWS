import StoryCardSkeleton from '@/components/StoryCardSkeleton';

/**
 * Route-level loading state.
 *
 * Shaped like the feed it replaces so the page doesn't reflow when content
 * arrives, and marked aria-busy so assistive tech announces the wait rather
 * than reading out placeholder geometry.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading stories…</span>

      <div className="mb-6 border-b border-[var(--border)] pb-2.5">
        <div className="skeleton h-5 w-64 rounded" />
      </div>
      <div className="mb-8 space-y-3 border-b-2 border-[var(--foreground)] pb-6">
        <div className="skeleton h-12 w-72 rounded" />
        <div className="skeleton h-4 w-full max-w-xl rounded" />
      </div>

      <StoryCardSkeleton variant="lead" />
      {Array.from({ length: 4 }).map((_, i) => (
        <StoryCardSkeleton key={i} variant="standard" />
      ))}
    </div>
  );
}
