"use client";

import Link from 'next/link';

import { AskSparkle } from './AskTrigger';
import { useAsk } from './AskProvider';
import CorroborationMeter from './CorroborationMeter';
import { CATEGORY_MAP, topicHue, type StoryDetail, type TopicPulse } from '@/lib/types';
import { ArrowRight } from '@/components/icons';

/**
 * The state of one beat, above its feed.
 *
 * A topic page was The Wire filtered to one category, with nothing to say
 * about the category itself. This answers the three questions a reader
 * arriving at a beat actually has, in the product's own terms:
 *
 *   Is it busy?        Today's count against the beat's own daily norm, with
 *                      a week of days behind it. "14 today" means nothing on
 *                      its own; "14, twice its usual" says the beat is moving.
 *   Can I trust it?    How much of today is confirmed by a second newsroom,
 *                      and the corroboration mix of what is on the page.
 *   Where do I start?  The beat's most corroborated story today, then the
 *                      beats it runs into this week — found from stories that
 *                      carry both topics, so the links are real overlaps.
 *
 * The pulse comes from /api/v1/topics (cached ten minutes). Without it the
 * panel falls back to what the stories on the page can say, so a slow or
 * failed pulse never costs the reader the page.
 */
export default function TopicInsights({
  category,
  stories,
  totalCount,
  pulse,
}: {
  category: string;
  stories: StoryDetail[];
  totalCount: number;
  pulse?: TopicPulse | null;
}) {
  const { open } = useAsk();
  const topic = CATEGORY_MAP[category];
  if (!topic || (stories.length === 0 && !pulse)) return null;

  const hue = topicHue(category);
  const name = topic.displayName;
  const lower = name.toLowerCase();

  const n = stories.length;
  const single = stories.filter((s) => s.independent_count <= 1).length;
  const confirmed = stories.filter((s) => s.independent_count === 2).length;
  const corroborated = stories.filter((s) => s.independent_count >= 3).length;
  const mix = [
    { label: 'Corroborated', value: corroborated, color: 'var(--verified-teal)' },
    { label: 'Confirmed', value: confirmed, color: 'var(--signal-amber)' },
    { label: 'Single source', value: single, color: 'var(--border-strong)' },
  ];

  const outletCounts = new Map<string, number>();
  stories.forEach((s) => (s.sources ?? []).forEach((o) => outletCounts.set(o, (outletCounts.get(o) ?? 0) + 1)));
  const topOutlets = [...outletCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxOutlet = topOutlets[0]?.[1] ?? 1;

  const related = (pulse?.related ?? []).filter((slug) => CATEGORY_MAP[slug]);
  const others = Object.values(CATEGORY_MAP).filter((t) => t.slug !== category && !related.includes(t.slug));

  return (
    <section
      aria-label={`${name} at a glance`}
      className="mb-10 space-y-4"
      style={{ '--beat': hue } as React.CSSProperties}
    >
      {/* ------------------------------------------------ the pulse */}
      {pulse && (
        <div className="grid overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)]">
          <div className="relative p-5 sm:p-6">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-[var(--beat)]" />
            <p className="eyebrow">Today on the beat</p>
            <div className="mt-3 flex items-end gap-4">
              <p className="font-display text-[56px] leading-[0.85] tabular-nums text-[var(--foreground)]">
                {pulse.today}
              </p>
              <Pace change={pulse.change} average={pulse.daily_average} />
            </div>
            <Sparkline days={pulse.days} />
          </div>

          <div className="border-t border-[var(--border)] p-5 sm:p-6 md:border-l md:border-t-0">
            <p className="eyebrow">Confirmed today</p>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="font-display text-[40px] leading-none tabular-nums text-[var(--verified-teal)]">
                {pulse.confirmed_today}
              </span>
              <span className="text-[13px] text-[var(--foreground-muted)]">of {pulse.today}</span>
            </p>
            <p className="mt-2 text-[13px] leading-snug text-[var(--foreground-muted)]">
              {pulse.today === 0
                ? `No new ${lower} stories in the last 24 hours.`
                : pulse.confirmed_today === 0
                ? 'Nothing here is confirmed by a second newsroom yet.'
                : `reported by two or more independent newsrooms.`}
            </p>
          </div>

          <div className="border-t border-[var(--border)] p-5 sm:p-6 md:border-l md:border-t-0">
            <p className="eyebrow">Leading the beat</p>
            {pulse.leading ? (
              <Link href={`/story/${pulse.leading.slug}`} className="group mt-3 block">
                <CorroborationMeter outlets={pulse.leading.independent_count} size="sm" />
                <span className="font-display mt-2 block text-[21px] leading-[1.15] text-balance text-[var(--foreground)] transition-colors group-hover:text-[var(--accent)]">
                  {pulse.leading.title}
                </span>
                <span className="mt-2 inline-flex items-center gap-1 text-[12px] text-[var(--foreground-muted)] group-hover:text-[var(--foreground)]">
                  Read the evidence <ArrowRight className="nudge-arrow" />
                </span>
              </Link>
            ) : (
              <p className="mt-3 text-[13px] text-[var(--foreground-muted)]">Quiet today. The latest is below.</p>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------ trust, people, next */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {n > 0 && (
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] p-5">
            <p className="eyebrow">Corroboration mix</p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-[36px] leading-none text-[var(--foreground)]">
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
              {totalCount.toLocaleString()} {lower} stories on the wire in total
            </p>
          </div>
        )}

        {topOutlets.length > 0 && (
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] p-5">
            <p className="eyebrow">Who is covering it</p>
            <ul className="mt-4 space-y-2.5">
              {topOutlets.map(([outlet, count]) => (
                <li key={outlet}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="truncate text-[var(--foreground)]">{outlet}</span>
                    <span className="font-data shrink-0 text-[11px] tabular-nums text-[var(--foreground-subtle)]">
                      {count} {count === 1 ? 'story' : 'stories'}
                    </span>
                  </div>
                  <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[var(--surface-sunken)]" aria-hidden="true">
                    <span className="block h-full rounded-full bg-[var(--beat)]" style={{ width: `${(count / maxOutlet) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="ai-border flex flex-col rounded-[var(--radius-card)] bg-[var(--surface-elevated)] p-5">
          <p className="flex items-center gap-2 text-[var(--accent)]">
            <AskSparkle />
            <span className="text-label">Ask about {name}</span>
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {[
              `What are the most corroborated ${lower} stories right now?`,
              `What is still unconfirmed in ${lower} today?`,
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
            {related.length > 0 && (
              <>
                <p className="mb-2 text-[11px] text-[var(--foreground-subtle)]">Runs into, this week</p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {related.map((slug) => (
                    <BeatLink key={slug} slug={slug} strong />
                  ))}
                </div>
              </>
            )}
            <p className="mb-2 text-[11px] text-[var(--foreground-subtle)]">Other beats</p>
            <div className="flex flex-wrap gap-1.5">
              {others.slice(0, related.length > 0 ? 5 : 8).map((t) => (
                <BeatLink key={t.slug} slug={t.slug} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BeatLink({ slug, strong = false }: { slug: string; strong?: boolean }) {
  return (
    <Link
      href={`/${slug}`}
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-1 text-[12px] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)] ${
        strong
          ? 'border-[var(--border-strong)] text-[var(--foreground)]'
          : 'border-[var(--border)] text-[var(--foreground-muted)]'
      }`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: topicHue(slug) }} />
      {CATEGORY_MAP[slug]?.displayName ?? slug}
    </Link>
  );
}

/** Today against the beat's own norm, in words. */
function Pace({ change, average }: { change: number | null; average: number }) {
  if (change === null) {
    return <p className="pb-1 text-[13px] text-[var(--foreground-muted)]">new stories in the last 24 hours</p>;
  }
  const ratio = change + 1;
  const [label, tone] =
    ratio >= 1.5
      ? [`${ratio.toFixed(1)}× its usual pace`, 'var(--beat)']
      : ratio >= 1.15
      ? [`busier than usual (+${Math.round(change * 100)}%)`, 'var(--beat)']
      : ratio > 0.85
      ? ['about its usual pace', 'var(--foreground-muted)']
      : [`quieter than usual (${Math.round(change * 100)}%)`, 'var(--foreground-subtle)'];
  return (
    <div className="pb-1">
      <p className="text-[14px] font-medium" style={{ color: tone }}>
        {label}
      </p>
      <p className="font-data mt-0.5 text-[11px] text-[var(--foreground-subtle)]">
        norm {average.toLocaleString(undefined, { maximumFractionDigits: 1 })} a day
      </p>
    </div>
  );
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Seven days of the beat; today's bar in the beat's hue. */
function Sparkline({ days }: { days: number[] }) {
  const max = Math.max(1, ...days);
  const today = new Date().getDay();
  return (
    <figure className="mt-5" aria-label={`Stories per day this week: ${days.join(', ')}`}>
      <div className="flex h-14 items-end gap-1.5">
        {days.map((count, i) => {
          const isToday = i === days.length - 1;
          return (
            <span
              key={i}
              className="flex-1 rounded-[3px] transition-[height] duration-700 ease-[var(--ease-out)]"
              style={{
                height: `${Math.max(6, (count / max) * 100)}%`,
                backgroundColor: isToday ? 'var(--beat)' : 'var(--border-strong)',
                opacity: isToday ? 1 : 0.55 + (i / days.length) * 0.35,
              }}
              title={`${count} ${count === 1 ? 'story' : 'stories'}`}
            />
          );
        })}
      </div>
      <figcaption className="font-data mt-1.5 flex gap-1.5 text-[10px] text-[var(--foreground-subtle)]" aria-hidden="true" suppressHydrationWarning>
        {days.map((_, i) => (
          <span key={i} className={`flex-1 text-center ${i === days.length - 1 ? 'text-[var(--foreground)]' : ''}`}>
            {DAY_LETTERS[(today - (days.length - 1 - i) + 7 * 2) % 7]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
