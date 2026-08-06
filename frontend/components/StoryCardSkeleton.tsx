/**
 * Loading placeholder, shaped like the card it stands in for so the feed does
 * not reflow when real content arrives.
 */
export default function StoryCardSkeleton({
  variant = 'standard',
}: {
  variant?: 'lead' | 'standard' | 'compact';
}) {
  if (variant === 'lead') {
    return (
      <div className="mb-10 border-b border-[var(--border)] pb-10" aria-hidden="true">
        <div className="skeleton aspect-[16/9] w-full rounded-[var(--radius-card)] sm:aspect-[21/9]" />
        <div className="space-y-3 pt-5">
          <div className="skeleton h-3 w-40 rounded" />
          <div className="skeleton h-9 w-11/12 rounded" />
          <div className="skeleton h-9 w-7/12 rounded" />
          <div className="skeleton h-4 w-full max-w-xl rounded" />
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="space-y-2 border-b border-[var(--border)] py-4" aria-hidden="true">
        <div className="skeleton h-4 w-10/12 rounded" />
        <div className="skeleton h-3 w-32 rounded" />
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--border)] py-7" aria-hidden="true">
      <div className="flex gap-5 sm:gap-7">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="skeleton h-3 w-44 rounded" />
          <div className="skeleton h-6 w-11/12 rounded" />
          <div className="skeleton h-6 w-2/3 rounded" />
          <div className="skeleton h-3.5 w-full max-w-lg rounded" />
        </div>
        <div className="skeleton h-24 w-24 shrink-0 rounded-[var(--radius-card)] sm:h-28 sm:w-40" />
      </div>
    </div>
  );
}
