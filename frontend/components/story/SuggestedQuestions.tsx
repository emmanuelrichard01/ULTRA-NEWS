"use client";

import { AskSparkle } from '@/components/AskTrigger';
import { useAsk } from '@/components/AskProvider';
import { ArrowRight } from '@/components/icons';

/**
 * Questions this story's reporting can answer, written with the brief.
 *
 * Generated alongside the brief rather than on demand, so they cost nothing
 * extra and are specific to the story ("Who voted against the resolution?")
 * where a fixed list could only be generic. Each one opens Ask scoped to this
 * story and asks immediately.
 */
export default function SuggestedQuestions({
  questions,
  slug,
  title,
}: {
  questions: string[];
  slug: string;
  title: string;
}) {
  const { open } = useAsk();
  if (questions.length === 0) return null;

  return (
    <div className="mt-8">
      <p className="mb-3 flex items-center gap-2 text-[var(--accent)]">
        <AskSparkle />
        <span className="text-label">Ask the reporting</span>
      </p>
      <ul className="flex flex-col gap-2">
        {questions.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => open({ story: { slug, title }, query: q })}
              className="group flex w-full items-center gap-3 rounded-[var(--radius-chip)] border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-left text-[14px] text-[var(--foreground)] transition-colors hover:border-[var(--border-strong)]"
            >
              <span className="min-w-0 flex-1">{q}</span>
              <ArrowRight className="nudge-arrow text-[var(--foreground-subtle)]" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
