import Link from 'next/link';

import { coverageSpread } from '@/lib/spread';
import type { StoryDetail } from '@/lib/types';

/**
 * Moving fastest — stories gaining independent outlets right now.
 *
 * Ranked by `momentum_outlets`: the independent publishers that joined a
 * cluster inside the last twelve hours. Two things follow from using that
 * column rather than `velocity_score`, which this panel used to read:
 *
 *   - It ranks the right thing. velocity_score is independent_count over hours
 *     alive, an average across a story's entire life, so it favours whatever
 *     is newest. On the live corpus its top twenty were all single-outlet
 *     stories minutes old. momentum_outlets is a count inside a sliding window,
 *     which is what "moving fastest" means.
 *   - It decays. A worker sweeps the column every five minutes, so a story that
 *     stops being picked up falls out on its own. Nothing here can be pinned by
 *     yesterday's success.
 *
 * What the bar shows, and why it is split:
 *
 * The first version drew one bar scaled to the leader, which encoded the same
 * number the label already gave — decoration with a data source. The bar is now
 * the story's whole corroboration, split at the window: the solid part is what
 * arrived in the last twelve hours, the faint part is what was already there.
 * That distinguishes the two situations a single count cannot — a story
 * breaking from nothing (all solid) from a long-running one that has suddenly
 * re-accelerated (mostly faint, with a solid cap) — and those want different
 * things from a reader.
 *
 * And the span. "Nine outlets" is the number; "nine outlets over 14h" is the
 * evidence. See lib/spread.ts — this is the distinction the project's README
 * opens with, and no list in the product was making it.
 */

interface MovingFastestProps {
  stories: StoryDetail[];
}

export default function MovingFastest({ stories }: MovingFastestProps) {
  const ranked = stories
    .filter((s) => (s.recent_outlets ?? 0) >= 2)
    .slice(0, 5);

  // An honestly empty panel rather than an empty box. On a quiet corpus nothing
  // is accelerating, and that is a real answer.
  if (ranked.length === 0) {
    return (
      <Shell>
        <p className="text-body-sm mt-4 text-[var(--foreground-subtle)]">
          Nothing is accelerating right now. Stories appear here when fresh
          outlets pick them up.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <ol className="mt-4 flex-1 space-y-3.5">
        {ranked.map((story, idx) => {
          const gained = story.recent_outlets ?? 0;
          const total = Math.max(story.independent_count, gained);
          const prior = Math.max(total - gained, 0);
          const spread = coverageSpread(
            story.first_seen_at,
            story.last_updated_at,
            total
          );

          return (
            <li
              key={story.slug}
              className="relative border-t border-[var(--border)] pt-3.5 first:border-0 first:pt-0"
            >
              <div className="mb-1.5 flex items-baseline gap-2">
                <span
                  className="font-data text-[11px] tabular-nums text-[var(--foreground-subtle)]"
                  aria-hidden="true"
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="font-data text-[11px] font-semibold tabular-nums text-[var(--accent)]">
                  +{gained}
                </span>
                <span className="font-data text-[11px] text-[var(--foreground-subtle)]">
                  in 12h
                </span>
                <span className="font-data ml-auto text-[11px] tabular-nums text-[var(--foreground-subtle)]">
                  {total} total
                </span>
              </div>

              {/*
                Split bar. Solid = joined inside the window, faint = already
                there. aria-hidden because both figures are stated in text
                above; the bar is a second channel, never the only one.
              */}
              <div
                className="mb-2 flex h-[3px] w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]"
                aria-hidden="true"
              >
                <span
                  className="h-full bg-[var(--accent)]"
                  style={{ width: `${(gained / total) * 100}%` }}
                />
                <span
                  className="h-full bg-[var(--accent)] opacity-25"
                  style={{ width: `${(prior / total) * 100}%` }}
                />
              </div>

              <h3 className="text-body-sm font-display leading-snug text-[var(--foreground)]">
                <Link
                  href={`/story/${story.slug}`}
                  className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-[var(--accent)]"
                >
                  {story.title}
                </Link>
              </h3>

              {/*
                The span, which is what tells a reader whether the count is
                worth anything. Phrased as the observation it is — the wording
                stops at "consistent with", because ten outlets inside half an
                hour is evidence of syndication, not proof of it.
              */}
              {spread.hours > 0 && (
                <p
                  className="font-data mt-1.5 text-[11px] tabular-nums text-[var(--foreground-subtle)]"
                  title={
                    spread.note === 'tight'
                      ? 'Coverage arrived in a tight window, which is consistent with outlets running a single wire report rather than reporting separately.'
                      : spread.note === 'sustained'
                      ? 'Coverage accumulated over a long span, which is more consistent with newsrooms working separately.'
                      : undefined
                  }
                >
                  over {spread.label}
                  {spread.note === 'tight' && (
                    <span className="text-[var(--accent-secondary)]">
                      {' '}
                      · tight window
                    </span>
                  )}
                  {spread.note === 'sustained' && (
                    <span className="text-[var(--foreground-muted)]">
                      {' '}
                      · sustained
                    </span>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {/*
        The panel is a window onto a whole edition, so it says so. Five rows of
        a ranking with no way through to the rest of it is a dead end.
      */}
      <Link
        href="/developing"
        className="text-label mt-5 inline-flex items-center gap-1.5 text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
      >
        All developing stories
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    </Shell>
  );
}

/**
 * `h-full` and a column layout so the panel fills its grid cell exactly.
 *
 * Without it the card sized to its own content and finished at a different
 * height from whatever sat beside it, which on a two-panel band reads as a
 * mistake rather than as a choice.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="moving-heading"
      className="flex h-full flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <h2 id="moving-heading" className="text-label text-[var(--foreground-muted)]">
        Moving fastest
      </h2>
      <p className="text-body-sm mt-1 text-[var(--foreground-subtle)]">
        Independent outlets gained in the last 12 hours, and how long the
        coverage took to spread.
      </p>
      {children}
    </section>
  );
}
