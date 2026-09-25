"use client";

import { AskSparkle } from '@/components/AskTrigger';
import { useAsk } from '@/components/AskProvider';

/**
 * "Ask about this story" — opens the Wire Room scoped to this cluster.
 *
 * Scoped questions are grounded in the story's whole cluster first (every
 * outlet's headline and lede, not the usual three), so "where do they
 * disagree?" gets an answer about THIS story rather than whichever neighbour
 * scored best on the words.
 */
export default function AskAboutStory({ slug, title }: { slug: string; title: string }) {
  const { open } = useAsk();
  const ask = (query?: string) => open({ story: { slug, title }, query });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => ask()} className="pill pill-solid group">
        <AskSparkle className="transition-transform duration-500 group-hover:rotate-[18deg]" />
        Ask about this story
      </button>
      {['Where do outlets disagree?', 'What is still unconfirmed?'].map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => ask(q)}
          className="pill pill-outline hidden text-[var(--foreground-muted)] hover:text-[var(--foreground)] sm:inline-flex"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
