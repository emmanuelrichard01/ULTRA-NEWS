import ListenButton from './story/ListenButton';
import SuggestedQuestions from './story/SuggestedQuestions';
import type { AISummary } from '@/lib/types';

/**
 * IntelligenceBrief — what the sources collectively say, and where they conflict.
 *
 * The discrepancies block is the part that earns its place. Anyone can summarise
 * agreement; surfacing where independent newsrooms contradict each other on
 * numbers, timelines or attribution is the thing a reader cannot easily do
 * themselves, and it's the natural companion to a corroboration count.
 *
 * Machine authorship is disclosed plainly rather than in 8px grey text. A brief
 * that isn't human-edited should say so where it can't be missed.
 */

interface IntelligenceBriefProps {
  aiSummary?: AISummary | null;
  synthesisStatus?: 'idle' | 'pending' | 'completed' | 'failed';
  sourceCount: number;
  independentCount: number;
  fallbackSummary?: string;
  /** For scoped suggested questions. */
  slug?: string;
  title?: string;
  /** What "Listen" reads — the brief as printed, caveats included. */
  listenText?: string;
}

export default function IntelligenceBrief({
  aiSummary,
  synthesisStatus,
  sourceCount,
  independentCount,
  fallbackSummary,
  slug,
  title,
  listenText,
}: IntelligenceBriefProps) {
  if (synthesisStatus === 'pending') {
    return (
      <section className="border-b border-[var(--border)] py-10">
        <p className="text-label mb-3 text-[var(--foreground-subtle)]">
          Synthesising brief…
        </p>
        <div className="space-y-2">
          <div className="skeleton h-5 w-11/12 rounded" />
          <div className="skeleton h-5 w-3/4 rounded" />
        </div>
      </section>
    );
  }

  // No brief yet — show the lead excerpt rather than an empty region.
  if (!aiSummary?.consensus_lead) {
    if (!fallbackSummary) return null;
    return (
      <section className="border-b border-[var(--border)] py-10">
        <p className="text-label mb-3 text-[var(--foreground-subtle)]">Lead excerpt</p>
        <p className="text-body-lg measure text-[var(--foreground)]">{fallbackSummary}</p>
      </section>
    );
  }

  const { consensus_lead, outlet_claims, discrepancies, primary_alignment, model } = aiSummary;
  const openQuestions = aiSummary.open_questions ?? [];
  const hasDiscrepancies = Boolean(discrepancies?.length);

  /**
   * A brief is either model-written or assembled from source text, and the two
   * need different labels. Previously both rendered as "Machine-written from N
   * articles · not human-edited · extractive-fallback" — a line that claims a
   * model wrote it and names the fallback that means one didn't, in the same
   * breath.
   */
  const isModelWritten =
    aiSummary.synthesis_type === 'llm' &&
    Boolean(model) &&
    model !== 'extractive-fallback' &&
    model !== 'system-fallback';

  return (
    <section aria-labelledby="brief-heading" className="border-b border-[var(--border)] py-12">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="brief-heading" className="eyebrow">
          {isModelWritten ? 'What the sources say' : 'Lead reporting'}
        </h2>
        {/* The rail carries Listen on wide screens; this is its home on a phone. */}
        {listenText && <ListenButton text={listenText} className="lg:hidden" />}
      </div>

      {/* The consensus in the serif, scaled to its length: a two-sentence model
          lead reads as a pull-quote, a long extractive excerpt steps down so it
          does not become a wall of display type. Formerly set against a rule
          down the left and the serif
          at reading size. It is the one paragraph on the page a reader should
          take away, so it is typeset like one. */}
      <p className={`measure font-display text-balance text-[var(--foreground)] ${consensus_lead.length > 200 ? "text-display-sm" : "text-display-md"}`}>
        {consensus_lead}
      </p>

      <p className="font-data mt-3 text-[11px] text-[var(--foreground-subtle)]">
        {isModelWritten
          ? `Written by ${model} from ${sourceCount} ${sourceCount === 1 ? 'article' : 'articles'} by ${independentCount} independent ${independentCount === 1 ? 'outlet' : 'outlets'}. Not human-edited — check it against the sources below.`
          : `Taken from the earliest report. No summary has been generated for this story yet.`}
      </p>

      {/* Conflicts first — the most valuable thing here, and the easiest to miss
          if buried under a list of things everyone agrees on. */}
      {hasDiscrepancies && (
        <div className="mt-6 rounded-[var(--radius-card)] border border-[var(--accent-secondary)]/25 bg-[var(--accent-secondary)]/8 p-4">
          <h3 className="text-label mb-2 text-[var(--accent-secondary)]">
            Where outlets disagree
          </h3>
          <ul className="text-body-sm space-y-1.5 text-[var(--foreground)]">
            {discrepancies!.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="text-[var(--accent-secondary)]">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {openQuestions.length > 0 && (
        <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-label mb-2 text-[var(--foreground-muted)]">Still unanswered</h3>
          <ul className="text-body-sm space-y-1.5 text-[var(--foreground)]">
            {openQuestions.map((item, i) => (
              <li key={i} className="flex gap-2.5">
                <span aria-hidden="true" className="font-display text-[var(--foreground-subtle)]">?</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {primary_alignment && (
        <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--accent)]/20 bg-[var(--accent)]/6 p-4">
          <h3 className="text-label mb-1.5 text-[var(--accent)]">
            Against primary sources
          </h3>
          <p className="text-body-sm text-[var(--foreground-muted)]">{primary_alignment}</p>
        </div>
      )}

      {outlet_claims && outlet_claims.length > 0 && (
        <details className="group mt-5">
          <summary className="text-label cursor-pointer list-none text-[var(--foreground-muted)] transition-colors marker:content-[''] hover:text-[var(--foreground)]">
            <span className="inline-flex items-center gap-1.5">
              What each outlet emphasised
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="transition-transform group-open:rotate-180" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </summary>
          <ul className="mt-3 space-y-3 border-l border-[var(--border)] pl-4">
            {outlet_claims.map((claim, i) => (
              <li key={i}>
                <span className="font-data text-[12px] font-semibold text-[var(--foreground)]">
                  {claim.source}
                </span>
                <p className="text-body-sm mt-0.5 text-[var(--foreground-muted)]">{claim.claim}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {slug && title && (
        <SuggestedQuestions questions={aiSummary.suggested_questions ?? []} slug={slug} title={title} />
      )}
    </section>
  );
}
