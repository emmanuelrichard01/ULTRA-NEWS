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
      <div className="mb-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]" aria-hidden="true">
        {/* The lead bento: a photograph with its headline set on it, three
            tiles beneath, and the ranking beside. */}
        <div className="space-y-4">
          <div className="skeleton aspect-[4/5] w-full rounded-[var(--radius-card)] sm:aspect-[16/10]" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton hidden aspect-[5/6] rounded-[var(--radius-card)] sm:block" />
            ))}
          </div>
        </div>
        <div className="hidden space-y-5 rounded-[var(--radius-card)] border border-[var(--border)] p-5 lg:block">
          <div className="skeleton h-7 w-40 rounded" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="skeleton h-7 w-8 shrink-0 rounded" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-full rounded" />
                <div className="skeleton h-4 w-2/3 rounded" />
              </div>
            </div>
          ))}
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
    <div className="border-b border-[var(--border)] py-6" aria-hidden="true">
      <div className="flex gap-4 sm:gap-6">
        <div className="skeleton order-last aspect-square w-20 shrink-0 rounded-[var(--radius-media)] sm:order-first sm:aspect-[4/3] sm:w-44" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="skeleton h-3.5 w-44 rounded" />
          <div className="skeleton h-5 w-11/12 rounded" />
          <div className="skeleton h-5 w-2/3 rounded" />
          <div className="skeleton h-3.5 w-full max-w-lg rounded" />
        </div>
      </div>
    </div>
  );
}
