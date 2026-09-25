"use client";

import { useEffect, useState } from "react";

import { AskSparkle } from "./AskTrigger";
import { useAsk } from "./AskProvider";
import CorroborationMeter from "./CorroborationMeter";
import ShareMenu from "./ShareMenu";
import { storyEvidence } from "@/lib/share";
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
  /** Enables "Ask about this story", which scopes retrieval to this cluster. */
  slug?: string;
}

/*
 * `isVerified` and `isDeveloping` used to be required props. Both were computed
 * at the call site from the outlet count, passed in, and then never read —
 * the component derives everything it needs from `sourceCount` through
 * describeCorroboration, which is the single place that mapping is allowed to
 * live. Two call sites computing thresholds by hand is how the vocabulary
 * drifts.
 */
export default function StickyStoryNav({ title, sourceCount, slug }: StickyStoryNavProps) {
  const { open } = useAsk();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsVisible(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const descriptor = describeCorroboration(sourceCount);

  return (
    <div
      aria-hidden={!isVisible}
      // Sits directly under the sticky section bar (z-50 at top-0) rather than
      // at top-0 itself, where it would slide in behind the bar and never be
      // seen. The hidden state tucks it up under the bar.
      className={`fixed inset-x-0 top-[calc(var(--header-h)-1px)] z-40 transition-all duration-300 ease-[var(--ease-out)] ${
        isVisible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"
      }`}
    >
      <div className="relative border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/85">
        <div className="mx-auto flex h-11 max-w-6xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
          <h2 className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--foreground)]">
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

          {slug && (
            <button
              type="button"
              onClick={() => open({ story: { slug, title } })}
              tabIndex={isVisible ? 0 : -1}
              className="ai-border flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--surface)] px-3 py-1.5 text-[12px] text-[var(--foreground)]"
            >
              <AskSparkle className="text-[var(--accent)]" />
              <span className="hidden sm:inline">Ask about this</span>
              <span className="sm:hidden">Ask</span>
            </button>
          )}
          {slug && (
            <ShareMenu
              path={`/story/${slug}`}
              title={title}
              evidence={storyEvidence(sourceCount)}
              cardPath={`/story/${slug}/opengraph-image`}
              variant="compact"
              label=""
              tabIndex={isVisible ? 0 : -1}
            />
          )}
        </div>
        {/* Reading progress, driven by the page's scroll timeline rather than
            a scroll listener. */}
        <div className="absolute inset-x-0 -bottom-px h-[2px] overflow-hidden" aria-hidden="true">
          <div className="read-progress h-full w-full bg-[var(--accent)]" />
        </div>
      </div>
    </div>
  );
}
