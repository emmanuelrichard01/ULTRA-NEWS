"use client";

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Route error boundary.
 *
 * Shows a recovery action rather than only an apology, and never renders the
 * raw error message — it can carry internal hostnames and query fragments, and
 * it means nothing to a reader regardless.
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
    <div className="mx-auto flex max-w-xl flex-col items-start py-24">
      <p className="text-label mb-3 text-[var(--wire-red)]">Something broke</p>
      <h1 className="text-display-xl font-display text-[var(--foreground)]">
        We couldn&rsquo;t load this page
      </h1>
      <p className="text-body-lg mt-4 text-[var(--foreground-muted)]">
        The wire room hit an unexpected error. Trying again usually works — the
        backend may have been briefly unreachable.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          onClick={reset}
          className="text-body-sm rounded-[var(--radius-card)] bg-[var(--foreground)] px-4 py-2.5 font-medium text-[var(--background)] transition-opacity hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="text-body-sm rounded-[var(--radius-card)] border border-[var(--border)] px-4 py-2.5 text-[var(--foreground)] transition-colors hover:border-[var(--border-hover)]"
        >
          Back to the wire
        </Link>
      </div>
      {error.digest && (
        <p className="font-data mt-8 text-[11px] text-[var(--foreground-subtle)]">
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
