"use client";

import { useEffect, useRef, useState } from 'react';

import { AskSparkle } from './AskTrigger';

/**
 * Ask, within thumb reach, on phones.
 *
 * On a phone the section bar's Ask button sits at the top of the screen — the
 * one place a thumb cannot reach while reading. This floats bottom-right
 * instead, and gets out of the way: it slides off while the reader scrolls
 * down (reading) and returns the moment they scroll up (looking for
 * something). Hidden from sm up, where the header controls are reachable.
 */
export default function AskFab({ onOpen, hidden }: { onOpen: () => void; hidden: boolean }) {
  const [tucked, setTucked] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      // A small dead zone, so the jitter of a resting thumb does not flicker it.
      if (Math.abs(delta) < 8) return;
      setTucked(delta > 0 && y > 240);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const away = hidden || tucked;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Ask the wire room"
      tabIndex={away ? -1 : 0}
      aria-hidden={away}
      className={`fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-40 flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--inverse)] py-3 pl-4 pr-5 text-[14px] font-medium text-[var(--inverse-foreground)] shadow-[var(--shadow-lg)] transition-all duration-300 ease-[var(--ease-out)] active:scale-95 sm:hidden ${
        away ? 'pointer-events-none translate-y-24 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <AskSparkle />
      Ask
    </button>
  );
}
