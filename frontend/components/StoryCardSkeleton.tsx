/**
 * StoryCardSkeleton — V3.1 Hydration Skeleton
 *
 * Prevents Cumulative Layout Shift (CLS) during feed initial loading
 * and category switching. Matches exact geometry of StoryCard.
 */

export default function StoryCardSkeleton({ variant = "standard" }: { variant?: "hero" | "standard" }) {
  if (variant === "hero") {
    return (
      <div className="animate-pulse mb-8">
        <div className="aspect-[16/9] sm:aspect-[2/1] lg:aspect-[21/9] w-full rounded-[var(--radius-card)] bg-[var(--surface-elevated)] p-6 sm:p-10 flex flex-col justify-end">
          <div className="flex gap-2 mb-3">
            <div className="h-4 w-16 bg-[var(--border)] rounded-sm" />
            <div className="h-4 w-24 bg-[var(--border)] rounded-sm" />
          </div>
          <div className="h-8 sm:h-10 bg-[var(--border)] rounded-sm w-4/5 mb-3" />
          <div className="h-8 sm:h-10 bg-[var(--border)] rounded-sm w-3/5 mb-4" />
          <div className="flex gap-4">
            <div className="h-3 w-20 bg-[var(--border)] rounded-sm" />
            <div className="h-3 w-32 bg-[var(--border)] rounded-sm" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-pulse py-5 border-b border-[var(--border)] flex flex-row-reverse sm:flex-row gap-5 items-start -mx-4 px-4">
      {/* Thumbnail skeleton */}
      <div className="w-24 h-24 sm:w-36 sm:h-24 bg-[var(--surface-elevated)] rounded-[var(--radius-card)] flex-shrink-0" />
      
      {/* Content skeleton */}
      <div className="flex-1 min-w-0 flex flex-col justify-between min-h-[96px]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-14 bg-[var(--surface-elevated)] rounded-sm" />
            <div className="h-3 w-20 bg-[var(--surface-elevated)] rounded-sm" />
          </div>
          <div className="h-5 bg-[var(--surface-elevated)] rounded-sm w-11/12" />
          <div className="h-5 bg-[var(--surface-elevated)] rounded-sm w-3/4" />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="h-3 w-28 bg-[var(--surface-elevated)] rounded-sm" />
          <div className="h-3 w-36 bg-[var(--surface-elevated)] rounded-sm" />
        </div>
      </div>
    </div>
  );
}
