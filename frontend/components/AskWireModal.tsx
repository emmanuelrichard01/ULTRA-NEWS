"use client";

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';

import { AskSparkle } from './AskTrigger';
import type { AskRequest } from './AskProvider';
import CorroborationMeter from './CorroborationMeter';
import { BROWSER_API_URL } from '@/lib/api';
import { relativeTime } from '@/lib/time';
import { ArrowRight } from '@/components/icons';

/**
 * Ask the Wire Room — the one generative surface in the product.
 *
 * Everything else reports a measured fact. This is the single place a machine
 * writes a sentence, so the design problem is not "make a chatbot look nice";
 * it is "make every sentence traceable". Three things do that:
 *
 *   Citations  The backend numbers the stories it retrieved and the model is
 *              told to cite them as [n]. Each marker renders as a chip that
 *              links to the story and lights up its card below — so a claim is
 *              one hover away from the reporting it came from, and the card
 *              says how many independent outlets stand behind it.
 *   Streaming  Tokens arrive as they are written. Previously the reader
 *              watched a spinner for ~10s and then the whole answer appeared;
 *              the endpoint never actually streamed (see core/services/ask.py).
 *   Honesty    The footer names the model, or says no model was involved, and
 *              flags an answer that was cut off mid-generation.
 */

type SynthesisMode = 'llm' | 'extractive';

interface Citation {
  n: number;
  slug: string;
  title: string;
  independent_count: number;
  outlets: string[];
  first_seen_at: string | null;
  image_url: string | null;
}

interface AskState {
  answer: string;
  sources: string[];
  citations: Citation[];
  mode: SynthesisMode;
  model: string | null;
  cached: boolean;
  streaming: boolean;
  degradedReason: string | null;
  truncatedReason: string | null;
}

/** A finished turn, kept on screen above the live one and sent as history. */
interface Turn {
  q: string;
  answer: string;
  citations: Citation[];
}

const EMPTY: AskState = {
  answer: '',
  sources: [],
  citations: [],
  mode: 'llm',
  model: null,
  cached: false,
  streaming: true,
  degradedReason: null,
  truncatedReason: null,
};

const SUGGESTIONS = [
  'What happened today that several outlets confirm?',
  'Any news on interest rates?',
  'What is still unconfirmed about the biggest story right now?',
];

const STORY_SUGGESTIONS = [
  'What do the outlets agree on?',
  'Where does the coverage disagree?',
  'What is still unconfirmed?',
];

/**
 * Narration shown only until the first event arrives.
 *
 * With real streaming that is a second or two — retrieval plus the first
 * token — so this rarely advances past its first two lines. It stays because
 * a cold embedding model or a slow provider can still take several seconds,
 * and an honest description of the pipeline beats a bare spinner.
 */
const WAITING_STAGES = [
  'Reading your question…',
  'Searching clustered coverage…',
  'Weighing corroboration…',
  'Opening the model…',
];
const STAGE_INTERVAL_MS = 1600;

const RECENT_KEY = 'ultranews:ask:recent';
const RECENT_MAX = 5;

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((q) => typeof q === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function pushRecent(query: string): string[] {
  const next = [query, ...readRecent().filter((q) => q !== query)].slice(0, RECENT_MAX);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private mode or storage disabled — recents are a convenience only.
  }
  return next;
}

// ==========================================================================
// Answer rendering
// ==========================================================================

/**
 * Inline markup: **bold**, _emphasis_, and [n] citations.
 *
 * Deliberately not a Markdown library. The model is instructed to use exactly
 * these three constructs plus "- " bullets, and rendering only those means no
 * HTML, links or images from model output can ever reach the DOM.
 */
function renderInline(
  text: string,
  keyPrefix: string,
  citations: Map<number, Citation>,
  onCite: (n: number | null) => void,
  activeCite: number | null
) {
  return text.split(/(\*\*[^*]+\*\*|_[^_\s][^_]*_|\[\d+(?:\s*,\s*\d+)*\])/g).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-[var(--foreground)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return (
        <em key={key} className="text-[var(--foreground-muted)]">
          {part.slice(1, -1)}
        </em>
      );
    }
    const citeMatch = part.match(/^\[(\d+(?:\s*,\s*\d+)*)\]$/);
    if (citeMatch) {
      const numbers = citeMatch[1].split(',').map((n) => Number(n.trim()));
      return (
        <Fragment key={key}>
          {numbers.map((n) => {
            const cite = citations.get(n);
            // A number that resolves to nothing is dropped rather than shown as
            // a dead chip. The model is told never to invent one; if it does,
            // the reader should not be offered a citation that goes nowhere.
            if (!cite) return null;
            return (
              <Link
                key={n}
                href={`/story/${cite.slug}`}
                className="cite-chip"
                data-active={activeCite === n}
                onMouseEnter={() => onCite(n)}
                onMouseLeave={() => onCite(null)}
                onFocus={() => onCite(n)}
                onBlur={() => onCite(null)}
                title={cite.title}
                aria-label={`Source ${n}: ${cite.title}`}
              >
                {n}
              </Link>
            );
          })}
        </Fragment>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

function AnswerBody({
  text,
  citations,
  streaming,
  onCite,
  activeCite,
}: {
  text: string;
  citations: Citation[];
  streaming: boolean;
  onCite: (n: number | null) => void;
  activeCite: number | null;
}) {
  const byNumber = new Map(citations.map((c) => [c.n, c]));

  // Group consecutive "- " lines into one list; everything else is a paragraph.
  const blocks: { kind: 'p' | 'ul'; lines: string[] }[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-*•]\s+/.test(line);
    const content = bullet ? line.replace(/^[-*•]\s+/, '') : line;
    const last = blocks[blocks.length - 1];
    if (bullet && last?.kind === 'ul') last.lines.push(content);
    else blocks.push({ kind: bullet ? 'ul' : 'p', lines: [content] });
  }

  return (
    <div className="text-body-lg space-y-3.5 text-[var(--foreground)]">
      {blocks.map((block, bi) => {
        const isLast = bi === blocks.length - 1;
        if (block.kind === 'ul') {
          return (
            <ul key={bi} className="space-y-2">
              {block.lines.map((line, li) => (
                <li key={li} className="flex gap-3">
                  <span aria-hidden="true" className="mt-[0.7em] h-1 w-1 shrink-0 rounded-full bg-[var(--foreground-subtle)]" />
                  <span className={streaming && isLast && li === block.lines.length - 1 ? 'stream-caret' : ''}>
                    {renderInline(line, `${bi}-${li}`, byNumber, onCite, activeCite)}
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className={streaming && isLast ? 'stream-caret' : ''}>
            {renderInline(block.lines[0], String(bi), byNumber, onCite, activeCite)}
          </p>
        );
      })}
      {blocks.length === 0 && streaming && <p className="stream-caret" aria-hidden="true" />}
    </div>
  );
}

// ==========================================================================
// Dialog
// ==========================================================================

export default function AskWireModal({
  isOpen,
  onClose,
  request,
}: {
  isOpen: boolean;
  onClose: () => void;
  request: AskRequest;
}) {
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState('');
  const [scope, setScope] = useState<{ slug: string; title: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<AskState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeCite, setActiveCite] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  // Completed earlier turns of this conversation, oldest first. The live turn
  // is `asked` + `state`; it joins the thread when a follow-up is asked.
  const [thread, setThread] = useState<Turn[]>([]);
  const [followQuery, setFollowQuery] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const currentRef = useRef<HTMLParagraphElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const handledRequest = useRef<number>(0);

  // Narrate the wait, but only until something arrives.
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      setStage((s) => Math.min(s + 1, WAITING_STAGES.length - 1));
    }, STAGE_INTERVAL_MS);
    return () => {
      clearInterval(id);
      setStage(0);
    };
  }, [loading]);

  // Reset on close; abort anything in flight so a closed dialog stops paying.
  useEffect(() => {
    if (isOpen) return;
    abortRef.current?.abort();
    const t = setTimeout(() => {
      setQuery('');
      setAsked('');
      setState(null);
      setError(null);
      setLoading(false);
      setScope(null);
      setCopied(false);
      setThread([]);
      setFollowQuery('');
    }, 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Escape closes; Tab is trapped inside; the page behind does not scroll.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
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

  const ask = useCallback(async (
    question: string,
    storyScope: { slug: string } | null,
    history: Turn[] = []
  ) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAsked(trimmed);
    setLoading(true);
    setError(null);
    setState(null);
    setCopied(false);
    setRecent(pushRecent(trimmed));

    try {
      const res = await fetch(`${BROWSER_API_URL}/api/v1/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          ...(storyScope ? { story: storyScope.slug } : {}),
          // The last three turns: enough for the backend to resolve "they" and
          // "that deal", and the most it accepts.
          ...(history.length > 0
            ? { history: history.slice(-3).map((t) => ({ q: t.q, a: t.answer.slice(0, 1500) })) }
            : {}),
        }),
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

      // Some paths (no matching coverage, embeddings offline) answer with
      // plain JSON rather than a stream.
      if (!res.headers.get('content-type')?.includes('text/event-stream')) {
        const data = await res.json();
        setState({
          ...EMPTY,
          answer: String(data.answer ?? ''),
          sources: data.context_sources ?? [],
          mode: 'extractive',
          streaming: false,
        });
        setLoading(false);
        return;
      }

      if (!res.body) throw new Error('No response stream.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let current: AskState = { ...EMPTY };
      let buffer = '';
      let done = false;

      while (!done) {
        const { value, done: finished } = await reader.read();
        done = finished;
        if (!value) continue;

        buffer += decoder.decode(value, { stream: true });
        // Split on a REAL newline. An earlier version split on the literal
        // two-character sequence backslash-n and parsed nothing, ever.
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let changed = false;
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
            continue;
          }

          changed = true;
          switch (event.type) {
            case 'metadata':
              current = {
                ...current,
                sources: (event.context_sources as string[]) ?? [],
                citations: (event.citations as Citation[]) ?? [],
                mode: (event.synthesis_type as SynthesisMode) ?? 'llm',
                cached: Boolean(event.cached),
              };
              break;
            case 'model':
              current = { ...current, model: String(event.model ?? '') || null };
              break;
            case 'chunk':
              current = { ...current, answer: current.answer + String(event.text ?? '') };
              break;
            case 'degraded':
              current = {
                ...current,
                mode: 'extractive',
                degradedReason: (event.reason as string) ?? null,
              };
              break;
            case 'truncated':
              current = { ...current, truncatedReason: (event.reason as string) ?? null };
              break;
            case 'done':
              current = {
                ...current,
                streaming: false,
                model: (event.model as string) ?? current.model,
                mode: (event.synthesis_type as SynthesisMode) ?? current.mode,
              };
              break;
            case 'error':
              throw new Error(String(event.text ?? 'Synthesis failed.'));
          }
        }

        // Once per network read rather than once per event: a burst of tokens
        // in one read is one render, not twenty.
        if (changed) {
          setLoading(false);
          setState({ ...current });
        }
      }

      setState({ ...current, streaming: false });
      setLoading(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setLoading(false);
    }
  }, []);

  // Apply whatever the opener asked for — once per open, keyed on its id.
  useEffect(() => {
    if (!isOpen || request.id === handledRequest.current) return;
    handledRequest.current = request.id;
    const { query: preset, story } = request.options;
    const t = setTimeout(() => {
      setRecent(readRecent());
      setScope(story ?? null);
      if (preset) {
        setQuery(preset);
        ask(preset, story ?? null);
      } else {
        inputRef.current?.focus();
      }
    }, 0);
    return () => clearTimeout(t);
  }, [isOpen, request, ask]);

  /**
   * Continue the conversation: the finished turn joins the thread, and the
   * follow-up is sent with it as history. The top input, by contrast, starts
   * over — a new topic should not drag the old one's context along.
   */
  const followUp = (question: string) => {
    if (!state || state.streaming || !asked || !question.trim()) return;
    const prior = [...thread, { q: asked, answer: state.answer, citations: state.citations }];
    setThread(prior);
    setFollowQuery('');
    setQuery('');
    ask(question, scope, prior);
  };

  const startOver = (question: string) => {
    setThread([]);
    ask(question, scope);
  };

  // Bring the new question into view as a turn begins; earlier turns stay
  // above it for reference.
  useEffect(() => {
    if (thread.length > 0) currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [thread.length]);

  const copyAnswer = async () => {
    if (!state?.answer) return;
    const refs = state.citations
      .map((c) => `[${c.n}] ${c.title} — ${window.location.origin}/story/${c.slug}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(`${state.answer}\n\n${refs}`.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked — nothing useful to tell the reader.
    }
  };

  if (!isOpen) return null;

  const suggestions = scope ? STORY_SUGGESTIONS : SUGGESTIONS;
  const idle = !loading && !state && !error;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-[rgb(8_9_11/0.55)] p-3 pt-[7vh] backdrop-blur-[6px] sm:p-4 sm:pt-[9vh]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-title"
        className="ai-border animate-fade-in-up flex max-h-[84vh] w-full max-w-2xl flex-col overflow-hidden rounded-[20px] bg-[var(--background)] shadow-[var(--shadow-lg)]"
      >
        <h2 id="ask-title" className="sr-only">
          Ask the wire room
        </h2>

        {/* ----------------------------------------------------- input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startOver(query);
          }}
          className="border-b border-[var(--border)] px-4 pb-3 pt-4 sm:px-5"
        >
          {scope && (
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex min-w-0 items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface)] py-1 pl-2.5 pr-1 text-[12px] text-[var(--foreground-muted)]">
                <span className="shrink-0 text-[var(--foreground-subtle)]">About</span>
                <span className="truncate font-medium text-[var(--foreground)]">{scope.title}</span>
                <button
                  type="button"
                  onClick={() => setScope(null)}
                  aria-label="Ask about all coverage instead"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--foreground)]"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <AskSparkle className="shrink-0 text-[var(--accent)]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={scope ? 'Ask about this story…' : 'Ask what the wire is reporting…'}
              maxLength={500}
              aria-label="Your question"
              className="min-w-0 flex-1 bg-transparent text-[17px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="pill pill-solid shrink-0 !px-3.5 !py-2 disabled:pointer-events-none disabled:opacity-25"
            >
              {loading ? (
                <span
                  aria-hidden="true"
                  className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
                />
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
              <span className="sr-only sm:not-sr-only">{loading ? 'Asking' : 'Ask'}</span>
            </button>
          </div>
        </form>

        {/* ------------------------------------------------------ body */}
        <div className="scroll-slim flex-1 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
          {/* Earlier turns, quieter than the live one: the question, the
              answer with its citations still clickable, and a rule. */}
          {thread.map((turn, i) => {
            const byNumber = new Map(turn.citations.map((c) => [c.n, c]));
            return (
              <div key={i} className="mb-6 border-b border-[var(--border)] pb-6 opacity-80 transition-opacity hover:opacity-100">
                <p className="font-display mb-2 text-[20px] leading-tight text-[var(--foreground-muted)]">{turn.q}</p>
                <AnswerBody text={turn.answer} citations={turn.citations} streaming={false} onCite={() => {}} activeCite={null} />
                {byNumber.size > 0 && (
                  <p className="font-data mt-3 text-[11px] text-[var(--foreground-subtle)]">
                    Drew on {byNumber.size} {byNumber.size === 1 ? 'story' : 'stories'}
                  </p>
                )}
              </div>
            );
          })}

          {asked && !idle && (
            <p ref={currentRef} className="font-display mb-4 scroll-mt-4 text-[26px] leading-tight text-[var(--foreground)]">
              {asked}
            </p>
          )}

          {loading && (
            <div aria-busy="true">
              <p className="text-body-sm mb-5 flex items-center gap-2.5 text-[var(--foreground-muted)]">
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
                </span>
                {WAITING_STAGES[stage]}
              </p>
              <div className="space-y-2.5">
                <div className="skeleton h-4 w-full rounded-full" />
                <div className="skeleton h-4 w-10/12 rounded-full" />
                <div className="skeleton h-4 w-7/12 rounded-full" />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-[var(--radius-card)] border border-[var(--wire-red)]/30 bg-[var(--wire-red)]/5 p-4">
              <p className="text-body-sm text-[var(--foreground)]">{error}</p>
              <button
                onClick={() => ask(asked || query, scope, thread)}
                className="pill pill-outline mt-3 !py-1.5 text-[12px]"
              >
                Try again
              </button>
            </div>
          )}

          {state && !error && (
            <div className="space-y-6">
              {state.degradedReason && (
                <p className="text-body-sm rounded-[var(--radius-chip)] border border-[var(--accent-secondary)]/25 bg-[var(--accent-secondary)]/8 px-3 py-2 text-[var(--foreground-muted)]">
                  {state.degradedReason}
                </p>
              )}

              {/* Before the first token, show what the answer will draw on.
                  The citations arrive in the first event, so the reader can
                  start scanning sources while the model writes. */}
              {state.streaming && !state.answer && state.citations.length > 0 && (
                <p className="text-body-sm text-[var(--foreground-muted)]">
                  Reading {state.citations.length}{' '}
                  {state.citations.length === 1 ? 'story' : 'stories'} from{' '}
                  {state.sources.length} {state.sources.length === 1 ? 'outlet' : 'outlets'}…
                </p>
              )}

              <AnswerBody
                text={state.answer}
                citations={state.citations}
                streaming={state.streaming}
                onCite={setActiveCite}
                activeCite={activeCite}
              />

              {state.truncatedReason && (
                <p className="text-body-sm rounded-[var(--radius-chip)] border border-[var(--wire-red)]/25 bg-[var(--wire-red)]/6 px-3 py-2 text-[var(--foreground-muted)]">
                  {state.truncatedReason}
                </p>
              )}

              {state.citations.length > 0 && (
                <section aria-labelledby="ask-sources" className="border-t border-[var(--border)] pt-5">
                  <h3 id="ask-sources" className="eyebrow mb-3">
                    Stories behind this answer
                  </h3>
                  <ol className="grid gap-2 sm:grid-cols-2">
                    {state.citations.map((c) => (
                      <li key={c.n}>
                        <Link
                          href={`/story/${c.slug}`}
                          onClick={onClose}
                          onMouseEnter={() => setActiveCite(c.n)}
                          onMouseLeave={() => setActiveCite(null)}
                          data-active={activeCite === c.n}
                          className="group card-lift flex h-full gap-3 rounded-[var(--radius-chip)] border border-[var(--border)] bg-[var(--surface-elevated)] p-3 data-[active=true]:border-[var(--accent)] data-[active=true]:shadow-[var(--shadow-md)]"
                        >
                          <span className="cite-chip !mx-0 mt-0.5 shrink-0" data-active={activeCite === c.n}>
                            {c.n}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="text-body-sm line-clamp-2 font-medium leading-snug text-[var(--foreground)]">
                              {c.title}
                            </span>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <CorroborationMeter outlets={c.independent_count} size="sm" />
                              {c.first_seen_at && (
                                <span className="font-data text-[11px] text-[var(--foreground-subtle)]" suppressHydrationWarning>
                                  {relativeTime(new Date(c.first_seen_at))}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {!state.streaming && state.answer && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                  <p className="font-data text-[11px] text-[var(--foreground-subtle)]">
                    {state.mode === 'llm'
                      ? `Written by ${state.model ?? 'a language model'} from the stories above. Check it against them.`
                      : 'Assembled directly from the stories above — no model involved.'}
                    {state.cached && ' · answered from cache'}
                  </p>
                  <button
                    type="button"
                    onClick={copyAnswer}
                    className="pill pill-outline !py-1.5 text-[12px]"
                  >
                    {copied ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      'Copy with sources'
                    )}
                  </button>
                </div>
              )}

              {/* Follow-up. Sent with the conversation so far, so "what did
                  they say in response?" retrieves the right story. */}
              {!state.streaming && state.answer && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    followUp(followQuery);
                  }}
                  className="flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface-elevated)] py-1.5 pl-4 pr-1.5 transition-colors focus-within:border-[var(--foreground)]"
                >
                  <input
                    type="text"
                    value={followQuery}
                    onChange={(e) => setFollowQuery(e.target.value)}
                    placeholder={thread.length >= 2 ? 'One more follow-up…' : 'Ask a follow-up…'}
                    maxLength={500}
                    aria-label="Follow-up question"
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!followQuery.trim()}
                    aria-label="Ask follow-up"
                    className="pill pill-solid !px-3 !py-2 disabled:opacity-25"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ---------------------------------------------- empty state */}
          {idle && (
            <div className="space-y-7">
              <ol className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Retrieves', 'Matches your question to clustered coverage, not keywords.'],
                  ['Cites', 'Every claim links to the story it came from.'],
                  ['Qualifies', 'Says so when a claim rests on one unconfirmed outlet.'],
                ].map(([title, body], i) => (
                  <li key={title} className="rounded-[var(--radius-chip)] bg-[var(--surface)] p-3">
                    <span className="font-data text-[11px] tabular-nums text-[var(--foreground-subtle)]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="mt-1 text-[13px] font-medium text-[var(--foreground)]">{title}</p>
                    <p className="mt-0.5 text-[12px] leading-snug text-[var(--foreground-muted)]">{body}</p>
                  </li>
                ))}
              </ol>

              <div>
                <p className="eyebrow mb-2.5">{scope ? 'Ask about this story' : 'Try one'}</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setQuery(suggestion);
                        ask(suggestion, scope);
                      }}
                      className="pill pill-outline group !py-2 text-[13px] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                    >
                      {suggestion}
                      <ArrowRight className="nudge-arrow" />
                    </button>
                  ))}
                </div>
              </div>

              {recent.length > 0 && !scope && (
                <div>
                  <p className="eyebrow mb-1.5">Recent</p>
                  <ul>
                    {recent.map((q) => (
                      <li key={q}>
                        <button
                          onClick={() => {
                            setQuery(q);
                            ask(q, null);
                          }}
                          className="group flex w-full items-center gap-3 rounded-[var(--radius-chip)] px-2 py-2 text-left text-[14px] text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-[var(--foreground-subtle)]">
                            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                            <path d="M3 3v5h5M12 7v5l3 2" />
                          </svg>
                          <span className="min-w-0 flex-1 truncate">{q}</span>
                          <ArrowRight className="nudge-arrow text-[var(--foreground-subtle)]" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --------------------------------------------------- footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[11px] text-[var(--foreground-subtle)] sm:px-5">
          <span>Answers only from reporting already on the wire. Nothing is browsed live.</span>
          <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <kbd className="font-data rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5">esc</kbd>
            to close
          </span>
        </div>
      </div>
    </div>
  );
}
