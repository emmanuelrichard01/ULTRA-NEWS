"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import { AskSparkle } from './AskTrigger';
import { BROWSER_API_URL } from '@/lib/api';

/**
 * Ask the Wire Room.
 *
 * Answers are grounded in retrieved story clusters, so the modal names the
 * outlets the answer drew on — a claim you can check is worth more than a
 * confident paragraph you can't.
 *
 * Three things the previous version got wrong:
 *   - A model failure ended at "Synthesis is temporarily unavailable" with no
 *     answer at all, even though retrieval had already succeeded. The backend
 *     now degrades to a source summary and flags it `degraded`; this renders
 *     that as a labelled answer rather than an error.
 *   - Cache hits weren't distinguished, so an instant response looked like a
 *     glitch rather than a hit.
 *   - `**bold**` markers streamed through as literal asterisks.
 */

type SynthesisMode = 'llm' | 'extractive';

interface AskState {
  answer: string;
  sources: string[];
  mode: SynthesisMode;
  cached: boolean;
  /** Set when the model failed and the answer came straight from sources. */
  degradedReason: string | null;
}

const EMPTY: AskState = {
  answer: '',
  sources: [],
  mode: 'llm',
  cached: false,
  degradedReason: null,
};

const SUGGESTIONS = [
  'What happened in Ukraine today?',
  'Any news on interest rates?',
  'What is the latest from Gaza?',
];

/**
 * Progress narration while an answer is generated.
 *
 * These are not decorative. Each line names a stage the request genuinely goes
 * through — embed the question, search the vectors, group into clusters, weigh
 * corroboration, draft — so the wait teaches the reader how the answer is
 * built rather than just filling time. A generic "Loading…" would hide the one
 * thing that makes this feature different from a search box.
 *
 * Timings are deliberately not synced to real backend events: a fresh answer
 * takes 5-15s depending on the model, and a progress bar that stalls at a
 * fabricated percentage is worse than honest narration that keeps moving.
 */
const WAITING_STAGES = [
  'Reading your question…',
  'Searching the wire…',
  'Grouping related coverage…',
  'Weighing corroboration…',
  'Drafting the answer…',
  'Almost there…',
];

const STAGE_INTERVAL_MS = 2200;

/**
 * Render the small subset of markdown the model actually emits: **bold**,
 * _italic_, and line breaks. A full markdown parser would be both a dependency
 * and an HTML-injection surface for text arriving from a model.
 */
function renderInline(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-[var(--foreground)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return (
        <em key={`${keyPrefix}-${i}`} className="text-[var(--foreground-subtle)]">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

function AnswerBody({ text }: { text: string }) {
  return (
    <div className="text-body-md space-y-3 text-[var(--foreground)]">
      {text.split('\n').map((line, i) =>
        line.trim() ? <p key={i}>{renderInline(line, String(i))}</p> : null
      )}
    </div>
  );
}

export default function AskWireModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<AskState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Advance the narration while waiting, stopping on the last line rather than
  // cycling — looping back to "Reading your question…" after 15 seconds would
  // read as a stall.
  useEffect(() => {
    if (!loading) {
      setStage(0);
      return;
    }
    const id = setInterval(() => {
      setStage((s) => Math.min(s + 1, WAITING_STAGES.length - 1));
    }, STAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loading]);

  // Reset on close, aborting any stream still running so a late chunk can't
  // repopulate a dialog the reader has dismissed.
  useEffect(() => {
    if (isOpen) return;
    abortRef.current?.abort();
    setQuery('');
    setState(null);
    setError(null);
    setLoading(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Focus trap. A modal that lets Tab escape into the page behind it
      // strands keyboard and screen-reader users outside a dialog they can
      // still hear but no longer control.
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  const ask = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setState(null);

    try {
      const res = await fetch(`${BROWSER_API_URL}/api/v1/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(
          res.status === 429
            ? 'Too many questions in a short window. Give it a minute.'
            : res.status === 503
            ? 'The wire room has hit its daily question limit. Try again tomorrow.'
            : 'The wire room is unreachable right now.'
        );
      }
      if (!res.body) throw new Error('No response stream.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let current: AskState = { ...EMPTY };
      let buffer = '';
      let done = false;

      setState(current);
      setLoading(false);

      while (!done) {
        const { value, done: finished } = await reader.read();
        done = finished;
        if (!value) continue;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          if (payload === '[DONE]') {
            done = true;
            break;
          }

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(payload);
          } catch {
            // Partial frame split across a chunk boundary; the rest follows.
            continue;
          }

          if (event.type === 'metadata') {
            current = {
              ...current,
              sources: (event.context_sources as string[]) ?? [],
              mode: (event.synthesis_type as SynthesisMode) ?? 'llm',
              cached: Boolean(event.cached),
            };
          } else if (event.type === 'chunk') {
            current = { ...current, answer: current.answer + String(event.text ?? '') };
          } else if (event.type === 'degraded') {
            current = {
              ...current,
              mode: 'extractive',
              degradedReason: (event.reason as string) ?? null,
            };
          } else if (event.type === 'error') {
            throw new Error(String(event.text ?? 'Synthesis failed.'));
          }
          setState({ ...current });
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setLoading(false);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-[var(--ink)]/60 p-4 pt-[8vh] backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-title"
        className="ai-border animate-fade-in flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--background)] shadow-[var(--shadow-lg)]"
      >
        {/*
          The header states what this is before the reader types anything.
          Previously it carried the name only, in 11px uppercase, which told
          someone who had just clicked a magnifying glass exactly nothing about
          why the answers would take fifteen seconds or where they came from.
        */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <AskSparkle className="mt-0.5 shrink-0 text-[var(--accent)]" />
            <div className="min-w-0">
              <h2
                id="ask-title"
                className="text-display-sm font-display text-[var(--foreground)]"
              >
                Ask the wire room
              </h2>
              <p className="text-body-sm mt-0.5 text-[var(--foreground-muted)]">
                Machine-written from clustered reporting, and it names the
                outlets it drew on.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded p-1 text-[var(--foreground-subtle)] transition-colors hover:text-[var(--foreground)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(query);
          }}
          className="border-b border-[var(--border)] px-5 py-4"
        >
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What is happening with…"
              maxLength={500}
              className="text-body-md flex-1 bg-transparent text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="text-label flex shrink-0 items-center gap-1.5 rounded-[var(--radius-chip)] bg-[var(--foreground)] px-3.5 py-2 text-[var(--background)] transition-opacity disabled:opacity-30"
            >
              {loading ? (
                <>
                  {/* A spinner only while the request is genuinely in flight —
                      once the stream opens, the words themselves are the
                      progress indicator. */}
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
                  />
                  Asking
                </>
              ) : (
                'Ask'
              )}
            </button>
          </div>
        </form>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && (
            <div aria-busy="true">
              {/* aria-live so the narration is announced, not just seen. */}
              <p
                aria-live="polite"
                className="text-body-sm mb-5 flex items-center gap-2.5 text-[var(--foreground-muted)]"
              >
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
                </span>
                {WAITING_STAGES[stage]}
              </p>
              <div className="space-y-2">
                <div className="skeleton h-4 w-full rounded" />
                <div className="skeleton h-4 w-10/12 rounded" />
                <div className="skeleton h-4 w-7/12 rounded" />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-[var(--radius-card)] border border-[var(--wire-red)]/30 bg-[var(--wire-red)]/5 p-4">
              <p className="text-body-sm text-[var(--foreground)]">{error}</p>
              <button
                onClick={() => ask(query)}
                className="text-label mt-3 rounded-[var(--radius-chip)] border border-[var(--border)] px-3 py-1.5 text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
              >
                Try again
              </button>
            </div>
          )}

          {state && !error && (
            <div className="space-y-5">
              {state.degradedReason && (
                <p className="text-body-sm rounded-[var(--radius-card)] border-l-2 border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/8 px-3 py-2 text-[var(--foreground-muted)]">
                  {state.degradedReason}
                </p>
              )}

              <AnswerBody text={state.answer} />

              {state.answer && (
                <div className="border-t border-[var(--border)] pt-4">
                  {state.sources.length > 0 && (
                    <>
                      <p className="text-label mb-2 text-[var(--foreground-subtle)]">
                        Grounded in {state.sources.length}{' '}
                        {state.sources.length === 1 ? 'outlet' : 'outlets'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {state.sources.map((source) => (
                          <span
                            key={source}
                            className="font-data rounded-[var(--radius-chip)] border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--foreground-muted)]"
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  <p className="font-data mt-3 text-[11px] text-[var(--foreground-subtle)]">
                    {state.mode === 'llm'
                      ? 'Machine-written from the sources above. Check it against them.'
                      : 'Assembled directly from the sources above — no model involved.'}
                    {state.cached && ' · from cache'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/*
            Empty state.

            Says how the answer is built, in three steps, because the honest
            selling point of this feature is the method: it retrieves real
            clusters and cites them, and it will tell you when a claim rests on
            one unconfirmed source. A reader who does not know that has no
            reason to trust the paragraph, and every reason to assume it is the
            same chatbot they have been offered everywhere else.
          */}
          {!loading && !state && !error && (
            <div>
              <ol className="mb-6 space-y-2.5">
                {[
                  'Your question is matched against clustered coverage, not keywords.',
                  'The answer is written from those stories and cites the outlets.',
                  'If it rests on a single unconfirmed source, it says so.',
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-data mt-[3px] shrink-0 text-[11px] tabular-nums text-[var(--foreground-subtle)]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-body-sm text-[var(--foreground-muted)]">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>

              <p className="text-label mb-2.5 text-[var(--foreground-subtle)]">
                Try one
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setQuery(suggestion);
                      ask(suggestion);
                    }}
                    className="text-body-sm rounded-[var(--radius-chip)] border border-[var(--border)] px-3 py-1.5 text-[var(--foreground-muted)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--foreground)]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
