import { describeCorroboration, outletPhrase } from '@/lib/corroboration';

/**
 * CorroborationMeter — the product's signature trust signal.
 *
 * Shows how many INDEPENDENT PUBLISHERS carry a story. Publishers, not articles:
 * two feeds from one newsroom are one source, because a newsroom corroborating
 * itself is not corroboration.
 *
 * Three rules this follows that the previous version didn't:
 *
 *   - Colour is never the only channel. The count and a text label are always
 *     present, so the signal survives greyscale and colour-blindness.
 *   - It shows evidence, not a verdict. "4 outlets" is checkable; "Reporting"
 *     was a label the reader had to take on faith — and it named our pipeline
 *     state rather than telling them anything.
 *   - Segments cap at six and the exact number is always rendered, so a story
 *     with 20 outlets doesn't look identical to one with six.
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
  sm: { bar: 'w-[3px]', unit: 7, gap: 'gap-[2px]', text: 'text-[11px]' },
  md: { bar: 'w-[3px]', unit: 9, gap: 'gap-[3px]', text: 'text-[12px]' },
  lg: { bar: 'w-[4px]', unit: 12, gap: 'gap-[3px]', text: 'text-[13px]' },
} as const;

export default function CorroborationMeter({
  outlets,
  showLabel = true,
  size = 'md',
  className = '',
}: CorroborationMeterProps) {
  const descriptor = describeCorroboration(outlets);
  const filled = Math.min(Math.max(outlets, 0), SEGMENTS);
  const s = SIZES[size];

  return (
    <div
      className={`inline-flex items-center gap-2 ${className}`}
      role="meter"
      aria-valuenow={outlets}
      aria-valuemin={0}
      aria-valuemax={SEGMENTS}
      aria-label={descriptor.description(outlets)}
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
              height: `${s.unit + i * 1.5}px`,
              backgroundColor:
                i < filled ? `var(${descriptor.colorVar})` : 'var(--border)',
            }}
          />
        ))}
      </div>

      {/* Exact count in tabular mono — the checkable fact. */}
      <span
        className={`font-data font-semibold tabular-nums ${s.text}`}
        style={{ color: `var(${descriptor.colorVar})` }}
      >
        {outlets}
      </span>

      {showLabel && (
        <span className={`font-data ${s.text} text-[var(--foreground-muted)] whitespace-nowrap`}>
          {outletPhrase(outlets)}
        </span>
      )}
    </div>
  );
}
