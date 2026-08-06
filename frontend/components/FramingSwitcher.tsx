"use client";

import { useId, useState } from 'react';

/**
 * FramingSwitcher — shows how different outlets headlined the same event.
 *
 * This is the most interesting thing the product knows, and the previous
 * implementation made it unreachable for most people: the outlet buttons swapped
 * the headline on `onMouseEnter` only. No touch device could use it, keyboard
 * users could focus the buttons but nothing happened, and the buttons were
 * nested inside the card's <a>, which is invalid HTML — hence the
 * `e.preventDefault()` calls scattered around to stop the link firing.
 *
 * Here it is a real tablist: click or arrow-key to select, hover as a bonus, and
 * it renders as a SIBLING of the card link rather than inside it.
 */

export interface Framing {
  source: string;
  title: string;
  url: string;
}

interface FramingSwitcherProps {
  /** The cluster's canonical headline, shown when nothing is selected. */
  baseTitle: string;
  framings: Framing[];
  onActiveChange: (title: string | null, source: string | null) => void;
  size?: 'sm' | 'md';
}

export default function FramingSwitcher({
  framings,
  onActiveChange,
  size = 'sm',
}: FramingSwitcherProps) {
  const [active, setActive] = useState<number | null>(null);
  const groupId = useId();

  if (framings.length < 2) return null;

  const select = (idx: number | null) => {
    setActive(idx);
    onActiveChange(
      idx === null ? null : framings[idx].title,
      idx === null ? null : framings[idx].source
    );
  };

  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next =
      e.key === 'ArrowRight'
        ? (idx + 1) % framings.length
        : (idx - 1 + framings.length) % framings.length;
    select(next);
    document.getElementById(`${groupId}-${next}`)?.focus();
  };

  const textSize = size === 'sm' ? 'text-[11px]' : 'text-[12px]';

  return (
    // z-10 lifts this above the card's stretched link so it stays clickable.
    <div className="relative z-10 flex flex-wrap items-center gap-1.5">
      <span className="text-label text-[var(--foreground-subtle)] mr-0.5">
        Framing
      </span>
      <div role="tablist" aria-label="Compare how outlets headlined this story" className="flex flex-wrap gap-1.5">
        {framings.map((frame, idx) => {
          const isActive = active === idx;
          return (
            <button
              key={`${frame.source}-${idx}`}
              id={`${groupId}-${idx}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => select(isActive ? null : idx)}
              onKeyDown={(e) => onKeyDown(e, idx)}
              onMouseEnter={() => select(idx)}
              onMouseLeave={() => select(null)}
              className={`font-data ${textSize} px-2 py-[3px] rounded-[var(--radius-chip)] border transition-colors ${
                isActive
                  ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]'
                  : 'bg-transparent text-[var(--foreground-muted)] border-[var(--border)] hover:border-[var(--border-hover)] hover:text-[var(--foreground)]'
              }`}
            >
              {frame.source}
            </button>
          );
        })}
      </div>
    </div>
  );
}
