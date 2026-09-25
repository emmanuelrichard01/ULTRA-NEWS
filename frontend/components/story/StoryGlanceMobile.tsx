import CorroborationMeter from '@/components/CorroborationMeter';
import { describeCorroboration } from '@/lib/corroboration';
import { coverageSpread } from '@/lib/spread';
import { relativeTime } from '@/lib/time';

/**
 * The story's evidence at a glance, for phones.
 *
 * On wide screens this lives in the sticky rail beside the story. Below lg the
 * rail is hidden, and with it went the four numbers that decide how much
 * weight a story can bear — so a phone reader, the majority, never saw the
 * pickup span or who broke it. Here they are a row of tiles under the
 * headline that scrolls sideways, costing one line of height.
 */
export default function StoryGlanceMobile({
  independentCount,
  articleCount,
  firstSeenAt,
  lastUpdatedAt,
  brokenBy,
}: {
  independentCount: number;
  articleCount: number;
  firstSeenAt: string;
  lastUpdatedAt: string;
  brokenBy?: string | null;
}) {
  const descriptor = describeCorroboration(independentCount);
  const spread = coverageSpread(firstSeenAt, lastUpdatedAt, independentCount);

  const tiles: { label: string; value: string }[] = [
    { label: 'Articles', value: articleCount.toLocaleString() },
    ...(spread.hours > 0 ? [{ label: 'Pickup span', value: spread.label }] : []),
    ...(brokenBy ? [{ label: 'Broke it', value: brokenBy }] : []),
    { label: 'Updated', value: relativeTime(new Date(lastUpdatedAt)) },
  ];

  return (
    <section aria-label="Evidence at a glance" className="mt-8 lg:hidden">
      <div className="pb-scrollbar -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        <div className="flex shrink-0 snap-start items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
          <span
            className="font-display text-[40px] leading-none tabular-nums"
            style={{ color: `var(${descriptor.colorVar})` }}
          >
            {independentCount}
          </span>
          <span className="leading-tight">
            <span className="block text-[12px] font-medium text-[var(--foreground)]">
              independent {independentCount === 1 ? 'newsroom' : 'newsrooms'}
            </span>
            <CorroborationMeter outlets={independentCount} size="sm" showLabel={false} className="mt-1" />
          </span>
        </div>
        {tiles.map((t) => (
          <div
            key={t.label}
            className="flex min-w-[7.5rem] shrink-0 snap-start flex-col justify-center rounded-[var(--radius-card)] border border-[var(--border)] px-4 py-3"
          >
            <span className="text-[11px] text-[var(--foreground-subtle)]">{t.label}</span>
            <span className="font-data mt-0.5 max-w-[11rem] truncate text-[13px] text-[var(--foreground)]" suppressHydrationWarning>
              {t.value}
            </span>
          </div>
        ))}
      </div>
      {spread.note && (
        <p className="mt-3 text-[12px] leading-snug text-[var(--foreground-muted)]">
          {spread.note === 'tight'
            ? 'Coverage arrived in a tight window — consistent with outlets running one wire report.'
            : 'Coverage accumulated over a long span — more consistent with newsrooms working separately.'}
        </p>
      )}
    </section>
  );
}
