/**
 * CategoryPill — V3 Component
 *
 * Mono caption, low-emphasis background.
 * Used on story cards and as navigation elements.
 */

interface CategoryPillProps {
  label: string;
  href?: string;
  isActive?: boolean;
}

export default function CategoryPill({ label, href, isActive = false }: CategoryPillProps) {
  const baseClasses = `
    inline-flex items-center px-2.5 py-1 rounded-[var(--radius-chip)]
    font-data text-[11px] font-semibold uppercase tracking-wider
    transition-colors duration-150
  `;

  const stateClasses = isActive
    ? "bg-[var(--foreground)] text-[var(--background)]"
    : "bg-[var(--surface-elevated)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)]";

  if (href) {
    return (
      <a href={href} className={`${baseClasses} ${stateClasses}`}>
        {label}
      </a>
    );
  }

  return (
    <span className={`${baseClasses} ${stateClasses}`}>
      {label}
    </span>
  );
}
