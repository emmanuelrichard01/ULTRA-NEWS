import Link from 'next/link';

import { outletPhrase } from '@/lib/corroboration';
import type { StoryDetail } from '@/lib/types';

/**
 * The "News update" strip from the reference layouts.
 *
 * A ticker was removed from this app once before, for good reasons: it filled
 * only from SSE `new_story` events, so on page load it was always empty, and it
 * opened an EventSource on every route to earn that emptiness. This one has
 * neither problem. It is server-rendered from stories the front page has
 * already fetched — the latest confirmed leads and what is moving fastest — so
 * it is populated in the first HTML byte and costs no request of its own.
 *
 * It runs only on the front page, pauses under the pointer or keyboard focus,
 * and stops entirely under reduced motion (the list then simply scrolls
 * horizontally). Every item carries its outlet count, so even the ticker makes
 * the product's one claim.
 */
export default function LiveTicker({ stories }: { stories: StoryDetail[] }) {
  const seen = new Set<string>();
  const items = stories.filter((s) => {
    if (seen.has(s.slug)) return false;
    seen.add(s.slug);
    return true;
  }).slice(0, 10);

  if (items.length < 3) return null;

  // Rendered twice back to back; the marquee translates by exactly one copy's
  // width (-50%) so the loop is seamless. The second copy is hidden from
  // assistive tech and from the tab order.
  const run = (copy: number) =>
    items.map((story) => (
      <li
        key={`${copy}-${story.slug}`}
        aria-hidden={copy === 1 ? true : undefined}
        className="flex shrink-0 items-center gap-3 pr-8"
      >
        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[var(--border-strong)]" />
        <Link
          href={`/story/${story.slug}`}
          tabIndex={copy === 0 ? undefined : -1}
          className="whitespace-nowrap text-[13px] text-[var(--foreground)] transition-colors hover:text-[var(--accent)]"
        >
          {story.title}
        </Link>
        <span className="font-data whitespace-nowrap text-[11px] tabular-nums text-[var(--foreground-subtle)]">
          {outletPhrase(story.independent_count)}
        </span>
      </li>
    ));

  return (
    <section
      aria-label="Latest on the wire"
      className="mb-8 flex items-center gap-4 overflow-hidden rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface-elevated)] py-2 pl-2 pr-0 shadow-[var(--shadow-sm)]"
    >
      <span className="flex shrink-0 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--wire-red)]/10 px-3 py-1.5 text-[12px] font-medium text-[var(--wire-red)]">
        <span className="live-dot" aria-hidden="true" />
        Wire update
      </span>
      <div className="ticker-mask pb-scrollbar min-w-0 flex-1 overflow-x-auto motion-safe:overflow-hidden">
        <ul className="animate-marquee flex w-max items-center">
          {run(0)}
          {run(1)}
        </ul>
      </div>
    </section>
  );
}
