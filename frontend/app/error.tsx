"use client";

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Route error boundary.
 *
 * Almost always the backend being briefly unreachable — a cold start on a free
 * host, a redeploy — so the primary action is "try again", and it says so.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[route error]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <span
        aria-hidden="true"
        className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--wire-red)]"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12h3l2.5-6 4 12 3-9 2 3H22" />
        </svg>
      </span>
      <p className="eyebrow mb-4 justify-center">The line went quiet</p>
      <h1 className="text-display-xl font-display text-[var(--foreground)]">
        We couldn&rsquo;t load this page
      </h1>
      <p className="text-body-lg mx-auto mt-4 max-w-md text-[var(--foreground-muted)]">
        The wire room hit an unexpected error. Trying again usually works — the
        backend may have been briefly unreachable while it woke up.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="pill pill-solid group">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-500 group-hover:-rotate-180">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Try again
        </button>
        <Link href="/" className="pill pill-outline">
          Back to The Wire
        </Link>
      </div>
      {error.digest && (
        <p className="font-data mt-10 text-[11px] text-[var(--foreground-subtle)]">
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
