import type { AISummary } from '@/lib/types';

/**
 * The structured half of a story brief.
 *
 * Both sections are model output that the backend has already refused in
 * part: a fact is shown only with outlets from this cluster standing behind
 * it, and a timeline entry only with a known outlet and a stated time (see
 * validate_brief in core/services/synthesis.py). What reaches this component
 * can therefore always show its sources — which is why every row does.
 */

export function KeyFacts({
  facts,
  independentCount,
}: {
  facts: NonNullable<AISummary['key_facts']>;
  independentCount: number;
}) {
  if (facts.length === 0) return null;

  return (
    <section id="facts" aria-labelledby="facts-heading" className="border-t border-[var(--border)] py-12">
      <h2 id="facts-heading" className="text-display-lg font-display text-[var(--foreground)]">
        What the reporting establishes
      </h2>
      <p className="text-body-sm measure mt-2 text-[var(--foreground-muted)]">
        Concrete claims, ordered by how many newsrooms state them. The bar shows
        that share of the {independentCount} outlets covering the story.
      </p>

      <ol className="mt-8 grid gap-3 sm:grid-cols-2">
        {facts.map((f, i) => {
          const share = Math.min(1, f.sources.length / Math.max(independentCount, 1));
          return (
            <li
              key={i}
              className="card-lift flex flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4"
            >
              <p className="text-[15px] font-medium leading-snug text-[var(--foreground)]">{f.fact}</p>
              <div className="mt-auto pt-4">
                <div className="flex h-[3px] overflow-hidden rounded-full bg-[var(--surface-sunken)]" aria-hidden="true">
                  <span className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(share * 100, 6)}%` }} />
                </div>
                <p className="font-data mt-2 text-[11px] text-[var(--foreground-subtle)]">
                  <span className="text-[var(--foreground-muted)]">
                    {f.sources.length} of {independentCount}
                  </span>{' '}
                  · {f.sources.slice(0, 3).join(', ')}
                  {f.sources.length > 3 && ` +${f.sources.length - 3}`}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function StoryUnfolding({ timeline }: { timeline: NonNullable<AISummary['timeline']> }) {
  if (timeline.length < 2) return null;

  return (
    <section id="unfolding" aria-labelledby="unfolding-heading" className="border-t border-[var(--border)] py-12">
      <h2 id="unfolding-heading" className="text-display-lg font-display text-[var(--foreground)]">
        How it unfolded
      </h2>
      <p className="text-body-sm measure mt-2 text-[var(--foreground-muted)]">
        Events as the reporting dates them — distinct from the corroboration
        timeline below, which orders when newsrooms <em>published</em>.
      </p>

      <ol className="relative mt-8 space-y-6 pl-6">
        <span aria-hidden="true" className="absolute bottom-2 left-[5px] top-2 w-px bg-gradient-to-b from-[var(--foreground)] via-[var(--border-strong)] to-transparent" />
        {timeline.map((t, i) => (
          <li key={i} className="relative">
            <span
              aria-hidden="true"
              className={`absolute -left-6 top-[6px] h-[11px] w-[11px] rounded-full border-2 ${
                i === timeline.length - 1
                  ? 'border-[var(--foreground)] bg-[var(--foreground)]'
                  : 'border-[var(--foreground)] bg-[var(--background)]'
              }`}
            />
            <p className="font-data text-[12px] font-semibold text-[var(--foreground)]">{t.when}</p>
            <p className="text-body-md mt-0.5 text-[var(--foreground)]">{t.event}</p>
            <p className="font-data mt-1 text-[11px] text-[var(--foreground-subtle)]">per {t.source}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
