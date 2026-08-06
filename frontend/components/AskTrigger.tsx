/**
 * AskTrigger — the entry point to the Wire Room.
 *
 * What was here: a bordered box containing a magnifying glass, the words "Ask
 * the wire room", and a ⌘K hint. The magnifying glass is the universal mark for
 * "search this text", which is precisely what this control does not do — it
 * retrieves clustered coverage and has a model write an answer over it. A
 * reader had no way to know that from the button, and the one genuinely
 * generative feature in the product was disguised as a search box.
 *
 * Three changes:
 *
 *   - A sparkle, not a lens. Drawn in the same family as every other icon here
 *     — 24-unit box, 2px stroke, round caps — so it reads as part of the set
 *     rather than as a pasted-in logo.
 *   - A light that travels the border, periodically and faster on approach.
 *     Nothing else in the product animates like this, which is what makes it
 *     mean something: it marks the one surface where a machine is writing.
 *   - Wording that says what it does. "Ask the wire room" is the name; the
 *     second line says answers are drawn from the reporting and cite it, which
 *     is the difference between this and a chatbot bolted onto a news site.
 */

export function AskSparkle({ className = '' }: { className?: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* Four-point star plus a small companion — the established mark for
          generated content, drawn to this project's stroke conventions. */}
      <path d="M11 3 12.9 8.6 18.5 10.5 12.9 12.4 11 18 9.1 12.4 3.5 10.5 9.1 8.6Z" />
      <path d="M18.5 15.5 19.3 17.7 21.5 18.5 19.3 19.3 18.5 21.5 17.7 19.3 15.5 18.5 17.7 17.7Z" />
    </svg>
  );
}

interface AskTriggerProps {
  onClick: () => void;
  className?: string;
}

export default function AskTrigger({ onClick, className = '' }: AskTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ai-border group flex shrink-0 items-center gap-2.5 rounded-[var(--radius-card)] bg-[var(--surface)] px-3.5 py-2 text-left transition-colors hover:bg-[var(--surface-elevated)] ${className}`}
    >
      <AskSparkle className="shrink-0 text-[var(--accent)] transition-transform duration-500 group-hover:rotate-[18deg]" />

      <span className="hidden leading-tight sm:block">
        <span className="text-body-sm block text-[var(--foreground)]">
          Ask the wire room
        </span>
        <span className="block text-[11px] text-[var(--foreground-subtle)]">
          Answers built from the reporting, with sources
        </span>
      </span>
      <span className="sr-only sm:hidden">Ask the wire room</span>

      <kbd className="font-data ml-1 hidden shrink-0 self-center rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] text-[var(--foreground-subtle)] sm:inline-block">
        ⌘K
      </kbd>
    </button>
  );
}
