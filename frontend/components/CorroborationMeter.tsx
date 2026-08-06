import {
  corroborationScale,
  describeCorroboration,
  outletPhrase,
} from '@/lib/corroboration';

/**
 * CorroborationMeter — the product's signature trust signal, in its
 * single-story form.
 *
 * Shows how many INDEPENDENT PUBLISHERS carry a story. Publishers, not
 * articles: two feeds from one newsroom are one source, because a newsroom
 * corroborating itself is not corroboration.
 *
 * This is the right form on a story page, an article page, or anywhere one
 * story is the subject. The feed uses CorroborationRail instead — same
 * vocabulary from lib/corroboration.ts, laid out so that four hundred of them
 * stacked vertically say something a single one cannot.
 *
 * Rules this follows:
 *
 *   - Colour is never the only channel. Segment count and a text label are
 *     always present, so the signal survives greyscale and colour-blindness.
 *   - It shows evidence, not a verdict. "4 outlets" is checkable; "Reporting"
 *     was a label the reader had to take on faith — and it named our pipeline
 *     state rather than telling them anything.
 *   - It does not saturate. Segments are allocated on a log scale and the last
 *     one carries an overflow tick past twelve outlets, so a story with 20
 *     outlets no longer renders identically to one with six.
 *   - It states the count once. This previously printed the numeral and then
 *     the phrase containing the same numeral — "16  16 outlets" — on every
 *     instance in the app.
 */

interface CorroborationMeterProps {
  /** Number of independent publishers. */
  outlets: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SEGMENTS = 6;

const SIZES = {
  sm: { bar: 'w-[3px]', unit: 7, step: 1.5, gap: 'gap-[2px]', text: 'text-[11px]' },
  md: { bar: 'w-[3px]', unit: 9, step: 1.5, gap: 'gap-[3px]', text: 'text-[12px]' },
  lg: { bar: 'w-[4px]', unit: 12, step: 2, gap: 'gap-[3px]', text: 'text-[13px]' },
} as const;

export default function CorroborationMeter({
  outlets,
  showLabel = true,
  size = 'md',
  className = '',
}: CorroborationMeterProps) {
  const descriptor = describeCorroboration(outlets);
  const s = SIZES[size];

  // Log-scaled fill rather than one segment per outlet. Counting segments
  // linearly is what made every story past six look the same.
  const filled =
    outlets <= 0 ? 0 : Math.max(1, Math.round(corroborationScale(outlets) * SEGMENTS));

  return (
    <div
      className={`inline-flex items-center gap-2 ${className}`}
      role="meter"
      aria-valuenow={outlets}
      aria-valuemin={0}
      aria-valuetext={descriptor.description(outlets)}
      aria-label="Independent corroboration"
      title={descriptor.description(outlets)}
    >
      <div className={`flex items-end ${s.gap}`} aria-hidden="true">
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <span
            key={i}
            className={`${s.bar} rounded-[1px] transition-colors duration-200`}
            style={{
              // Rising heights read as a signal-strength meter rather than a
              // progress bar, which is the right metaphor: more outlets is
              // stronger evidence, not closer to done.
              height: `${s.unit + i * s.step}px`,
              backgroundColor:
                i < filled ? `var(${descriptor.colorVar})` : 'var(--border)',
            }}
          />
        ))}
      </div>

      {/*
        The count, stated once.

        With a label, the phrase already contains the number ("4 outlets"), so
        printing a separate numeral beside it is pure duplication. Without a
        label — the compact form used in sticky nav and dense rows — the numeral
        is the only thing carrying it, so it appears.
      */}
      <span
        className={`font-data font-semibold tabular-nums whitespace-nowrap ${s.text}`}
        style={{ color: `var(${descriptor.colorVar})` }}
      >
        {showLabel ? outletPhrase(outlets) : outlets}
      </span>
    </div>
  );
}
