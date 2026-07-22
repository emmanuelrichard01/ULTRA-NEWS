/**
 * CategoryPill — V3.1 Component
 *
 * Per-category accent colors for visual differentiation.
 * Mono caption, low-emphasis background.
 * Used on story cards, feed headers, and navigation elements.
 */

import Link from 'next/link';

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  tech:          { bg: 'rgba(99, 102, 241, 0.12)',  text: '#6366f1', border: 'rgba(99, 102, 241, 0.25)' },
  politics:      { bg: 'rgba(244, 63, 94, 0.10)',   text: '#f43f5e', border: 'rgba(244, 63, 94, 0.25)' },
  business:      { bg: 'rgba(16, 185, 129, 0.10)',   text: '#10b981', border: 'rgba(16, 185, 129, 0.25)' },
  entertainment: { bg: 'rgba(217, 70, 239, 0.10)',   text: '#d946ef', border: 'rgba(217, 70, 239, 0.25)' },
  science:       { bg: 'rgba(6, 182, 212, 0.12)',    text: '#06b6d4', border: 'rgba(6, 182, 212, 0.25)' },
  art:           { bg: 'rgba(251, 146, 60, 0.12)',   text: '#fb923c', border: 'rgba(251, 146, 60, 0.25)' },
  sports:        { bg: 'rgba(34, 197, 94, 0.12)',    text: '#22c55e', border: 'rgba(34, 197, 94, 0.25)' },
  health:        { bg: 'rgba(236, 72, 153, 0.10)',   text: '#ec4899', border: 'rgba(236, 72, 153, 0.25)' },
  world:         { bg: 'rgba(59, 130, 246, 0.12)',   text: '#3b82f6', border: 'rgba(59, 130, 246, 0.25)' },
};

const DEFAULT_COLOR = { bg: 'var(--surface-elevated)', text: 'var(--foreground-muted)', border: 'var(--border)' };

interface CategoryPillProps {
  label: string;
  href?: string;
  isActive?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

export default function CategoryPill({ label, href, isActive = false, size = 'sm' }: CategoryPillProps) {
  const slug = label.toLowerCase();
  const colors = CATEGORY_COLORS[slug] || DEFAULT_COLOR;

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[9px]',
    sm: 'px-2.5 py-1 text-[11px]',
    md: 'px-3 py-1.5 text-xs',
  };

  const baseClasses = `
    inline-flex items-center rounded-[var(--radius-chip)]
    font-data font-semibold uppercase tracking-wider
    transition-all duration-150
    ${sizeClasses[size]}
  `;

  const style = isActive
    ? { backgroundColor: colors.text, color: '#fff', borderColor: 'transparent' }
    : { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border };

  const className = `${baseClasses} border ${isActive ? 'shadow-sm' : 'hover:brightness-110'}`;

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {label}
      </Link>
    );
  }

  return (
    <span className={className} style={style}>
      {label}
    </span>
  );
}
