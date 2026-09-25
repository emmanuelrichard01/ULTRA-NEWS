"use client";

import Link from 'next/link';

import { AskSparkle } from './AskTrigger';
import { useAsk } from './AskProvider';
import { CATEGORY_MAP, type StoryDetail } from '@/lib/types';
import { ArrowRight } from '@/components/icons';

/**
 * The state of one beat, above its feed.
 *
 * A topic page was The Wire filtered to one category, with nothing to say
 * about the category itself. These figures come from the stories already on
 * the page, so they cost no request:
 *
 *   Corroboration mix  how much of this beat is confirmed right now. A beat
 *                      that is 80% single-source reads very differently from
 *                      one that is mostly corroborated, and the mix bar shows
 *                      it at a glance.
 *   Who is covering it the newsrooms most present in this beat — the answer
 *                      to "whose view of this beat am I getting?".
 */
export default function TopicInsights({
  category,
  stories,
  totalCount,
}: {
  category: string;
  stories: StoryDetail[];
  totalCount: number;
}) {
  const { open } = useAsk();
  const topic = CATEGORY_MAP[category];
  if (!topic || stories.length === 0) return null;

  const single = stories.filter((s) => s.independent_count <= 1).length;
  const confirmed = stories.filter((s) => s.independent_count === 2).length;
  const corroborated = stories.filter((s) => s.independent_count >= 3).length;
  const n = stories.length;

  const outletCounts = new Map<string, number>();
  stories.forEach((s) => (s.sources ?? []).forEach((o) => outletCounts.set(o, (outletCounts.get(o) ?? 0) + 1)));
  const topOutlets = [...outletCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxOutlet = topOutlets[0]?.[1] ?? 1;

  const others = Object.values(CATEGORY_MAP).filter((t) => t.slug !== category);

  const mix = [
    { label: 'Corroborated', value: corroborated, color: 'var(--verified-teal)' },
    { label: 'Confirmed', value: confirmed, color: 'var(--signal-amber)' },
    { label: 'Single source', value: single, color: 'var(--border-strong)' },
  ];

  return (
    <section aria-label={`${topic.displayName} at a glance`} className="mb-10 grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
        <p className="eyebrow">Corroboration mix</p>
        <p className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-[44px] leading-none text-[var(--foreground)]">
            {Math.round(((confirmed + corroborated) / n) * 100)}%
          </span>
          <span className="text-[13px] text-[var(--foreground-muted)]">
            of the latest {n} confirmed by a second newsroom
          </span>
        </p>
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]" aria-hidden="true">
          {mix.map((m) =>
            m.value > 0 ? (
              <span key={m.label} className="h-full transition-[width] duration-700" style={{ width: `${(m.value / n) * 100}%`, backgroundColor: m.color }} />
            ) : null
          )}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {mix.map((m) => (
            <li key={m.label} className="flex items-center gap-1.5 text-[12px] text-[var(--foreground-muted)]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} aria-hidden="true" />
              {m.label} <span className="font-data tabular-nums text-[var(--foreground-subtle)]">{m.value}</span>
            </li>
          ))}
        </ul>
        <p className="font-data mt-3 text-[11px] text-[var(--foreground-subtle)]">
          {totalCount.toLocaleString()} {topic.displayName.toLowerCase()} stories on the wire in total
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--border)] p-5">
        <p className="eyebrow">Who is covering it</p>
        <ul className="mt-4 space-y-2.5">
          {topOutlets.map(([name, count]) => (
            <li key={name}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate text-[var(--foreground)]">{name}</span>
                <span className="font-data shrink-0 text-[11px] tabular-nums text-[var(--foreground-subtle)]">
                  {count} {count === 1 ? 'story' : 'stories'}
                </span>
              </div>
              <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[var(--surface-sunken)]" aria-hidden="true">
                <span className="block h-full rounded-full bg-[var(--foreground)]/70" style={{ width: `${(count / maxOutlet) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="ai-border flex flex-col rounded-[var(--radius-card)] bg-[var(--surface-elevated)] p-5">
        <p className="flex items-center gap-2 text-[var(--accent)]">
          <AskSparkle />
          <span className="text-label">Ask about {topic.displayName}</span>
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {[
            `What are the most corroborated ${topic.displayName.toLowerCase()} stories right now?`,
            `What is still unconfirmed in ${topic.displayName.toLowerCase()} today?`,
          ].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => open({ query: q })}
              className="group flex items-start gap-2 rounded-[var(--radius-chip)] border border-[var(--border)] px-3 py-2 text-left text-[13px] leading-snug text-[var(--foreground-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
            >
              <span className="min-w-0 flex-1">{q}</span>
              <ArrowRight className="nudge-arrow" />
            </button>
          ))}
        </div>
        <div className="mt-auto pt-4">
          <p className="mb-2 text-[11px] text-[var(--foreground-subtle)]">Other beats</p>
          <div className="flex flex-wrap gap-1.5">
            {others.slice(0, 6).map((t) => (
              <Link
                key={t.slug}
                href={`/${t.slug}`}
                className="rounded-[var(--radius-pill)] border border-[var(--border)] px-2.5 py-1 text-[12px] text-[var(--foreground-muted)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
              >
                {t.displayName}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
