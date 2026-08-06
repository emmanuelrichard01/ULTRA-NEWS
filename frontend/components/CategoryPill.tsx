import Link from 'next/link';

import { CATEGORY_MAP } from '@/lib/types';

/**
 * CategoryPill — topic chip.
 *
 * Renders the semantically correct element for its role: a link when it
 * navigates, a button when it toggles, a span when it is only a label. The
 * previous version was always a span, so the feed wrapped it in an outer
 * <button> to make it clickable — which meant screen readers announced an
 * unlabelled control and keyboard focus landed in an odd place.
 */

interface CategoryPillProps {
  label: string;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

const SIZES = {
  xs: 'px-1.5 py-[3px] text-[10px]',
  sm: 'px-2.5 py-1.5 text-[11px]',
  md: 'px-3 py-1.5 text-[12px]',
} as const;

export default function CategoryPill({
  label,
  href,
  onClick,
  isActive = false,
  size = 'sm',
}: CategoryPillProps) {
  // Slugs arrive from the API; show the human name where we know one.
  const display = CATEGORY_MAP[label]?.displayName ?? label;

  const className = [
    'inline-flex shrink-0 items-center rounded-[var(--radius-chip)] border',
    'font-data font-medium uppercase tracking-[0.07em] whitespace-nowrap',
    'transition-colors duration-150',
    SIZES[size],
    isActive
      ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]'
      : 'border-[var(--border)] bg-transparent text-[var(--foreground-muted)] hover:border-[var(--border-hover)] hover:text-[var(--foreground)]',
  ].join(' ');

  if (href) {
    return (
      <Link href={href} className={`relative z-10 ${className}`}>
        {display}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={isActive} className={`relative z-10 ${className}`}>
        {display}
      </button>
    );
  }

  return <span className={className}>{display}</span>;
}
