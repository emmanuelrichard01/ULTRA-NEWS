"use client";

import { useEffect, useState } from "react";

import CorroborationMeter from "./CorroborationMeter";
import { describeCorroboration } from "@/lib/corroboration";

/**
 * Condensed story header that appears once the masthead scrolls away.
 *
 * Keeps the corroboration count on screen while reading, which is the point —
 * the reader should never lose track of how well-supported the thing they're
 * reading actually is.
 */

interface StickyStoryNavProps {
  title: string;
  /** Independent publishers. */
  sourceCount: number;
}

/*
 * `isVerified` and `isDeveloping` used to be required props. Both were computed
 * at the call site from the outlet count, passed in, and then never read —
 * the component derives everything it needs from `sourceCount` through
 * describeCorroboration, which is the single place that mapping is allowed to
 * live. Two call sites computing thresholds by hand is how the vocabulary
 * drifts.
 */
export default function StickyStoryNav({ title, sourceCount }: StickyStoryNavProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsVisible(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const descriptor = describeCorroboration(sourceCount);

  /**
   * Share the page's actual URL.
   *
   * This used to receive a hardcoded `https://ultra-news.demo/story/...`, so
   * every shared link pointed at a domain that doesn't exist. Reading
   * window.location at click time is correct on any host, in any environment.
   */
  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User dismissed the sheet, or the gesture wasn't trusted — fall through
        // to clipboard rather than leaving the click with no effect.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure origin or denied permission). Say nothing
      // rather than firing an alert() that blocks the page.
    }
  };

  return (
    <div
      aria-hidden={!isVisible}
      className={`fixed inset-x-0 top-0 z-40 transition-transform duration-300 ease-out ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/85">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-2.5 sm:px-6">
          <h2 className="min-w-0 flex-1 truncate font-display text-[15px] text-[var(--foreground)]">
            {title}
          </h2>

          <div
            className="hidden shrink-0 items-center gap-2 sm:flex"
            title={descriptor.description(sourceCount)}
          >
            <CorroborationMeter outlets={sourceCount} size="sm" showLabel={false} />
            <span className="font-data text-[11px] text-[var(--foreground-muted)]">
              {descriptor.label}
            </span>
          </div>

          <button
            onClick={handleShare}
            className="text-label shrink-0 rounded-[var(--radius-chip)] border border-[var(--border)] px-2.5 py-1.5 text-[var(--foreground-muted)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--foreground)]"
          >
            {copied ? "Copied" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}
