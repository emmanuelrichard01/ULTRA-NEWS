"use client";

import { useEffect, useId, useRef, useState } from 'react';

import { CATEGORY_MAP } from '@/lib/types';

/**
 * TopicFilter — nine topics behind one control.
 *
 * These were nine chips plus an "All topics" chip, laid out in a scrolling row
 * directly under a three-way corroboration segment. Counting the edition tabs
 * and the Ask button, a first-time visitor met seventeen controls before one
 * headline, in four stacked bands, with no indication of which mattered — and
 * every one of them was a bordered box competing for the same attention.
 *
 * Filtering by topic is worth keeping and is not worth that. It is a
 * refinement: something a reader reaches for after deciding they want less than
 * everything, which is by definition not their first move. So it collapses to a
 * single control that names the current state ("Topics: All"), and opens to the
 * full list on demand — one item in the header instead of ten.
 *
 * Built as a real menu rather than the `<details>` disclosure used elsewhere:
 * a details element stays open when the reader clicks away or presses Escape,
 * which on a filter that changes the page underneath it leaves a panel covering
 * the result of the action just taken.
 */

const TOPICS = Object.entries(CATEGORY_MAP).map(([slug, info]) => ({
  slug,
  displayName: info.displayName,
}));

interface TopicFilterProps {
  active?: string;
  onChange: (slug: string | undefined) => void;
}

export default function TopicFilter({ active, onChange }: TopicFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const activeName = active
    ? CATEGORY_MAP[active]?.displayName ?? active
    : 'All topics';

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const select = (slug: string | undefined) => {
    onChange(slug);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-haspopup="menu"
        className={`text-body-sm flex items-center gap-2 rounded-[var(--radius-card)] border px-3 py-2 transition-colors ${
          active
            ? 'border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)]'
            : 'border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--border-hover)] hover:text-[var(--foreground)]'
        }`}
      >
        <span className="text-[var(--foreground-subtle)]">Topic</span>
        <span className="font-medium">{activeName}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          className="animate-fade-in-up absolute right-0 z-30 mt-2 w-56 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 shadow-[var(--shadow-lg)]"
        >
          <MenuItem
            label="All topics"
            isActive={!active}
            onSelect={() => select(undefined)}
          />
          <div className="my-1.5 h-px bg-[var(--border)]" />
          {TOPICS.map((topic) => (
            <MenuItem
              key={topic.slug}
              label={topic.displayName}
              isActive={active === topic.slug}
              onSelect={() => select(topic.slug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  isActive,
  onSelect,
}: {
  label: string;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={isActive}
      onClick={onSelect}
      className={`text-body-sm flex w-full items-center justify-between rounded-[var(--radius-chip)] px-3 py-2 text-left transition-colors ${
        isActive
          ? 'bg-[var(--surface)] text-[var(--foreground)]'
          : 'text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]'
      }`}
    >
      {label}
      {isActive && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </button>
  );
}
