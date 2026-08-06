/**
 * Loading placeholder, shaped like the card it stands in for so the feed does
 * not reflow when real content arrives.
 *
 * Geometry mirrors StoryCard exactly — the metadata line, the two headline
 * lines, the excerpt, the thumbnail. When the two drift apart the feed visibly
 * jumps at the moment real content lands, which is the one thing a skeleton
 * exists to prevent.
 */
export default function StoryCardSkeleton({
  variant = 'standard',
}: {
  variant?: 'lead' | 'standard' | 'compact';
}) {
  if (variant === 'lead') {
    return (
      <div className="mb-8 border-b border-[var(--border)] pb-8" aria-hidden="true">
        {/* Image first, matching the lead card. */}
        <div className="skeleton mb-5 aspect-[16/9] w-full rounded-[var(--radius-card)] sm:aspect-[21/9]" />
        <div className="space-y-3">
          <div className="skeleton h-3.5 w-48 rounded" />
          <div className="skeleton h-9 w-11/12 rounded" />
          <div className="skeleton h-9 w-7/12 rounded" />
          <div className="skeleton h-4 w-full max-w-xl rounded" />
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="space-y-2 border-b border-[var(--border)] py-3.5" aria-hidden="true">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-4 w-10/12 rounded" />
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--border)] py-5" aria-hidden="true">
      <div className="flex gap-4 sm:gap-6">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="skeleton h-3.5 w-44 rounded" />
          <div className="skeleton h-5 w-11/12 rounded" />
          <div className="skeleton h-5 w-2/3 rounded" />
          <div className="skeleton h-3.5 w-full max-w-lg rounded" />
        </div>
        <div className="skeleton h-20 w-20 shrink-0 rounded-[var(--radius-card)] sm:h-24 sm:w-32" />
      </div>
    </div>
  );
}
