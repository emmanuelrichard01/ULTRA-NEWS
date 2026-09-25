"use client";

import Link from 'next/link';

import { AskSparkle } from './AskTrigger';
import { useAsk } from './AskProvider';
import type { StoryDetail } from '@/lib/types';
import { ArrowRight } from '@/components/icons';

/**
 * The rail beside The Wire's chronological feed.
 *
 * It used to hold Moving Fastest, which now leads the front page beside the
 * hero where a ranking earns its place. What a reader deep in a chronological
 * list needs instead is two things the list itself cannot say:
 *
 *   1. What the number on every card means. The meter was explained only in
 *      the footer and on /about — nowhere a reader passes while reading.
 *   2. A way to ask about what they are reading. The suggestions are built
 *      from the stories currently leading, so they are questions the wire can
 *      actually answer today, not generic prompts that retrieve nothing.
 */

const LEGEND = [
  { filled: 1, color: 'var(--foreground-subtle)', label: 'One outlet', meaning: 'Reported once — early, not doubtful.' },
  { filled: 2, color: 'var(--signal-amber)', label: 'Two outlets', meaning: 'A second newsroom has confirmed it.' },
  { filled: 4, color: 'var(--verified-teal)', label: 'Three or more', meaning: 'Independently corroborated.' },
];

/** A question about a lead story, its headline trimmed to something a person would type. */
function questionFor(title: string): string {
  const short = title
    .replace(/\s*[|–—:-]\s.*$/, '')
    .split(/\s+/)
    .slice(0, 9)
    .join(' ')
    .replace(/[,.;:!?]+$/, '');
  // Quoted rather than re-cased: headlines lead with proper nouns, and
  // lowercasing "Ukraine" to fit a sentence would be a small, visible error.
  return `What is confirmed so far on “${short}”?`;
}

export default function WireRail({ leads }: { leads: StoryDetail[] }) {
  const { open } = useAsk();
  const questions = leads.slice(0, 3).map((s) => questionFor(s.title));

  return (
    <div className="space-y-5">
      <Link
        href="/briefing"
        className="group card-lift flex items-center gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--inverse)] text-[var(--inverse-foreground)]">
          <AskSparkle />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-display block text-[22px] leading-tight text-[var(--foreground)]">The Briefing</span>
          <span className="block text-[12px] text-[var(--foreground-muted)]">Today&rsquo;s confirmed stories, in two minutes</span>
        </span>
        <ArrowRight className="nudge-arrow text-[var(--foreground-subtle)]" />
      </Link>

      <section
        aria-labelledby="rail-ask"
        className="ai-border overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface-elevated)] p-5"
      >
        <p className="flex items-center gap-2 text-[var(--accent)]">
          <AskSparkle />
          <span className="text-label">Ask the wire room</span>
        </p>
        <h2 id="rail-ask" className="font-display mt-3 text-[26px] leading-tight text-[var(--foreground)]">
          Ask what the coverage actually says.
        </h2>
        <p className="text-body-sm mt-2 text-[var(--foreground-muted)]">
          Answers are written from stories on the wire, cite them by number, and
          flag anything resting on a single outlet.
        </p>

        {questions.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {questions.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => open({ query: q })}
                  className="group flex w-full items-start gap-2 rounded-[var(--radius-chip)] border border-[var(--border)] px-3 py-2 text-left text-[13px] leading-snug text-[var(--foreground-muted)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                >
                  <span className="min-w-0 flex-1">{q}</span>
                  <ArrowRight className="nudge-arrow mt-px text-[var(--foreground-subtle)]" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button type="button" onClick={() => open()} className="pill pill-solid mt-4 w-full justify-center">
          Ask your own question
          <kbd className="font-data rounded-[5px] bg-white/15 px-1.5 py-0.5 text-[10px]">⌘K</kbd>
        </button>
      </section>

      <section aria-labelledby="rail-legend" className="rounded-[var(--radius-card)] border border-[var(--border)] p-5">
        <h2 id="rail-legend" className="eyebrow">
          Reading the count
        </h2>
        <ul className="mt-4 space-y-3.5">
          {LEGEND.map((row) => (
            <li key={row.label} className="flex items-start gap-3">
              <span className="mt-1 flex items-end gap-[2px]" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="w-[3px] rounded-[1px]"
                    style={{
                      height: `${6 + i * 2}px`,
                      backgroundColor: i < row.filled ? row.color : 'var(--border)',
                    }}
                  />
                ))}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-[var(--foreground)]">{row.label}</span>
                <span className="block text-[12px] leading-snug text-[var(--foreground-muted)]">{row.meaning}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-[var(--border)] pt-3 text-[12px] leading-snug text-[var(--foreground-subtle)]">
          Newsrooms, not articles: five updates from one publisher count once. A
          high count measures agreement, not truth.{' '}
          <Link href="/about" className="text-[var(--foreground-muted)] underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--foreground)]">
            How it works
          </Link>
        </p>
      </section>
    </div>
  );
}
