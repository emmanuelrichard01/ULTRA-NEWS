/**
 * SourceChip — V3 Component
 *
 * Outlet name display, used in source lists and search facets.
 * Mono-styled to signal "machine-verified fact."
 */

interface SourceChipProps {
  name: string;
  showDot?: boolean;
}

export default function SourceChip({ name, showDot = true }: SourceChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 font-data text-[11px] text-[var(--foreground-muted)]">
      {showDot && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--verified-teal)] opacity-60" />
      )}
      <span className="font-medium">{name}</span>
    </span>
  );
}
