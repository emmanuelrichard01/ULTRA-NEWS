"use client";

/**
 * CorroborationMeter — V3 Signature Component
 *
 * 5-segment signal-bar indicator showing how many independent sources
 * are covering a story. This is the design's core trust signal.
 *
 * 1-2 filled = amber ("Developing")
 * 3+  filled = teal  ("Corroborated")
 *
 * Always paired with exact numeral + text label (accessibility: §9).
 * Color is never the only signal.
 */

interface CorroborationMeterProps {
  sourceCount: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function CorroborationMeter({
  sourceCount,
  showLabel = true,
  size = "md",
}: CorroborationMeterProps) {
  const segments = 5;
  const filled = Math.min(sourceCount, segments);
  const status = sourceCount >= 3 ? "corroborated" : "developing";

  const sizeClasses = {
    sm: { segment: "w-[3px] h-[10px]", text: "text-[10px]", gap: "gap-[2px]" },
    md: { segment: "w-[4px] h-[14px]", text: "text-[11px]", gap: "gap-[3px]" },
    lg: { segment: "w-[5px] h-[18px]", text: "text-xs", gap: "gap-1" },
  };

  const s = sizeClasses[size];

  return (
    <div className="flex items-center gap-2" role="meter" aria-valuenow={sourceCount} aria-valuemin={0} aria-valuemax={5} aria-label={`${sourceCount} sources, ${status}`}>
      {/* Signal bars */}
      <div className={`flex items-end ${s.gap}`}>
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={`
              ${s.segment} rounded-[1px] transition-all duration-200
              ${i < filled
                ? status === "corroborated"
                  ? "bg-[var(--verified-teal)]"
                  : "bg-[var(--signal-amber)]"
                : "bg-[var(--border)]"
              }
            `}
            style={{ height: `${10 + i * 2}px` }}
          />
        ))}
      </div>

      {/* Numeral — always shown (mono = "machine-verified fact") */}
      <span className={`font-data font-semibold ${s.text} ${
        status === "corroborated"
          ? "text-[var(--verified-teal)]"
          : "text-[var(--signal-amber)]"
      }`}>
        {sourceCount}
      </span>

      {/* Text label — accessibility, never color-only */}
      {showLabel && (
        <span className={`font-data ${s.text} text-[var(--foreground-muted)]`}>
          {status === "corroborated" ? "Reporting" : "Developing"}
        </span>
      )}
    </div>
  );
}
