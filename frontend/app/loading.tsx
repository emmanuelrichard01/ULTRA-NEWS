/**
 * V3 Loading Skeleton — shape-matched to actual components.
 * Per V3 UI spec §6: "the skeleton loader for each dynamic hole should be
 * the exact shape of the real component."
 */

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto animate-pulse">
      {/* Header skeleton */}
      <div className="border-b-2 border-[var(--border)] pb-6 mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="h-12 w-48 bg-[var(--surface-elevated)] rounded mb-2" />
            <div className="h-5 w-80 bg-[var(--surface-elevated)] rounded" />
          </div>
          <div className="h-10 w-64 bg-[var(--surface-elevated)] rounded-[var(--radius-card)]" />
        </div>
      </div>

      {/* Hero card skeleton — matches StoryCard hero variant shape */}
      <div className="mb-12">
        <div className="aspect-[16/9] sm:aspect-[2/1] lg:aspect-[21/9] w-full rounded-[var(--radius-card)] bg-[var(--surface-elevated)]" />
      </div>

      {/* Section label */}
      <div className="h-3 w-24 bg-[var(--surface-elevated)] rounded mb-6" />

      {/* Feed card skeletons — matches StoryCard standard variant */}
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex gap-5 py-5 border-b border-[var(--border)]">
          {/* Thumbnail skeleton */}
          <div className="w-24 h-24 sm:w-36 sm:h-24 rounded-[var(--radius-card)] bg-[var(--surface-elevated)] flex-shrink-0" />
          {/* Content skeleton */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex gap-2 mb-2">
                <div className="h-3 w-12 bg-[var(--surface-elevated)] rounded" />
                <div className="h-3 w-16 bg-[var(--surface-elevated)] rounded" />
              </div>
              <div className="h-5 w-full bg-[var(--surface-elevated)] rounded mb-1.5" />
              <div className="h-5 w-3/4 bg-[var(--surface-elevated)] rounded" />
            </div>
            {/* Corroboration meter skeleton */}
            <div className="flex items-center gap-1 mt-2">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="w-1 bg-[var(--surface-elevated)] rounded-sm" style={{ height: `${10 + j * 2}px` }} />
              ))}
              <div className="h-3 w-4 bg-[var(--surface-elevated)] rounded ml-1" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
