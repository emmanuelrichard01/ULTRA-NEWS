import Link from 'next/link';

import { StoryTile } from '@/components/cards';
import { fetchStories } from '@/lib/api';
import { ArrowRight } from '@/components/icons';

export const metadata = { title: 'Not found' };

/**
 * 404.
 *
 * The usual cause here is not a typo: stories are clusters, and clusters merge
 * as coverage accumulates, so a slug that was valid this morning can be
 * absorbed into another story by the afternoon. So the page says that, and
 * rather than dead-ending, offers the best-corroborated stories right now —
 * the likeliest thing the reader was after.
 */
export default async function NotFound() {
  const record = await fetchStories({ sort: 'significance', minSources: 3, limit: 3 });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid items-end gap-10 border-b border-[var(--border)] pb-14 pt-6 lg:grid-cols-[auto_minmax(0,1fr)]">
        <p
          aria-hidden="true"
          className="font-display select-none text-[clamp(7rem,20vw,13rem)] leading-[0.8] tracking-[-0.04em] text-[var(--foreground)]"
        >
          4<span className="italic text-[var(--foreground-subtle)]">0</span>4
        </p>
        <div className="max-w-xl pb-2">
          <p className="eyebrow mb-4">Not on the wire</p>
          <h1 className="text-display-xl font-display text-[var(--foreground)]">
            This story may have merged into another
          </h1>
          <p className="text-body-lg mt-4 text-[var(--foreground-muted)]">
            Stories are grouped as coverage accumulates, so a link can shift when
            two clusters turn out to be one event. Or the address was mistyped.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/" className="pill pill-solid group">
              Back to The Wire <ArrowRight className="nudge-arrow" />
            </Link>
            <Link href="/briefing" className="pill pill-outline">
              Today&rsquo;s Briefing
            </Link>
          </div>
        </div>
      </div>

      {record.items.length > 0 && (
        <section aria-labelledby="nf-heading" className="py-12">
          <p className="eyebrow mb-3">Best corroborated right now</p>
          <h2 id="nf-heading" className="text-display-md font-display mb-8 text-[var(--foreground)]">
            Perhaps you were looking for one of these
          </h2>
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-3">
            {record.items.map((story) => (
              <StoryTile key={story.slug} story={story} showExcerpt={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
