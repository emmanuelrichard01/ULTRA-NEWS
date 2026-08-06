import Link from 'next/link';

import CorroborationMeter from './CorroborationMeter';
import type { StoryDetail } from '@/lib/types';

/**
 * Stories accumulating independent coverage fastest.
 *
 * Ranked by the API across the whole feed. This component used to re-sort
 * whatever page happened to be loaded, so it ranked a 20-story window and
 * presented it as "fastest moving" — a story accelerating further down the feed
 * could never appear.
 */
export default function VelocityLeaderboard({ stories }: { stories: StoryDetail[] }) {
  // Only stories with real corroboration; a single-source item has nothing
  // meaningful to say about how fast coverage is spreading.
  const ranked = stories.filter((s) => s.independent_count >= 2).slice(0, 5);

  if (ranked.length === 0) return null;

  return (
    <section
      aria-labelledby="velocity-heading"
      className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <h2
        id="velocity-heading"
        className="text-label mb-1 text-[var(--foreground-muted)]"
      >
        Moving fastest
      </h2>
      <p className="text-body-sm mb-5 text-[var(--foreground-subtle)]">
        Independent outlets picking up a story per hour.
      </p>

      <ol className="space-y-4">
        {ranked.map((story, idx) => (
          <li key={story.slug} className="relative">
            <div className="flex gap-3">
              <span
                className="font-data mt-[2px] text-[12px] tabular-nums text-[var(--foreground-subtle)]"
                aria-hidden="true"
              >
                {String(idx + 1).padStart(2, '0')}
              </span>

              <div className="min-w-0 flex-1">
                <h3 className="text-body-sm font-display leading-snug text-[var(--foreground)]">
                  <Link
                    href={`/story/${story.slug}`}
                    className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-[var(--accent)]"
                  >
                    {story.title}
                  </Link>
                </h3>

                <div className="mt-2 flex items-center gap-3">
                  <CorroborationMeter
                    outlets={story.independent_count}
                    size="sm"
                    showLabel={false}
                  />
                  <span className="font-data text-[11px] tabular-nums text-[var(--foreground-subtle)]">
                    {story.velocity_score.toFixed(1)}/hr
                  </span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
