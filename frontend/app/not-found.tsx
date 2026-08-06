import Link from 'next/link';

/**
 * 404.
 *
 * There was no not-found.tsx, so a missing story fell through to the framework
 * default — an unstyled page with no way back into the product. Stories can 404
 * legitimately (a slug changes, a cluster is merged), so this is a route readers
 * will actually hit.
 */
export const metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start py-24">
      <p className="text-label mb-3 text-[var(--foreground-subtle)]">Error 404</p>
      <h1 className="text-display-xl font-display text-[var(--foreground)]">
        This page isn&rsquo;t on the wire
      </h1>
      <p className="text-body-lg mt-4 text-[var(--foreground-muted)]">
        The story may have been merged into another cluster, or the link may be
        mistyped. Stories are grouped as coverage accumulates, so URLs can shift.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="text-body-sm rounded-[var(--radius-card)] bg-[var(--foreground)] px-4 py-2.5 font-medium text-[var(--background)] transition-opacity hover:opacity-90"
        >
          Back to the wire
        </Link>
        <Link
          href="/record"
          className="text-body-sm rounded-[var(--radius-card)] border border-[var(--border)] px-4 py-2.5 text-[var(--foreground)] transition-colors hover:border-[var(--border-hover)]"
        >
          Browse The Record
        </Link>
      </div>
    </div>
  );
}
