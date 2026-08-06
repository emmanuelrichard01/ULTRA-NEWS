import type { Metadata } from 'next';
import Link from 'next/link';

import { EDITIONS } from '@/lib/editions';

/**
 * Subscribe.
 *
 * This page previously showed an email form that set `status = 'success'` on
 * submit and posted nowhere. It told people they had subscribed when nothing
 * had happened and no address was stored — a UI that lies about the outcome of
 * an action, which is worse than not offering the action at all.
 *
 * The honest version offers the thing that genuinely works: per-edition RSS,
 * which now exists, and says plainly that email digests do not.
 */

export const metadata: Metadata = {
  title: 'Subscribe',
  description:
    'Follow Ultra News by RSS — one feed per edition, each item carrying its corroboration level.',
};

const FEED_PATHS: Record<string, string> = {
  '': '/api/v1/feeds/wire.xml',
  developing: '/api/v1/feeds/developing.xml',
  record: '/api/v1/feeds/record.xml',
};

export default function SubscribePage() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  return (
    <div className="mx-auto max-w-3xl">
      <header className="border-b-2 border-[var(--foreground)] pb-7">
        <h1 className="text-display-2xl font-display text-[var(--foreground)]">Subscribe</h1>
        <p className="text-body-lg measure mt-3 text-[var(--foreground-muted)]">
          One feed per edition. Every item states how many independent outlets
          stand behind the story, so the corroboration count travels with it into
          your reader.
        </p>
      </header>

      <section aria-labelledby="feeds-heading" className="py-9">
        <h2 id="feeds-heading" className="sr-only">
          Available feeds
        </h2>

        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {EDITIONS.map((edition) => {
            const path = FEED_PATHS[edition.slug];
            if (!path) return null;
            return (
              <li
                key={edition.slug || 'wire'}
                className="flex flex-wrap items-start justify-between gap-4 py-5"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-display-sm font-display text-[var(--foreground)]">
                    {edition.name}
                  </h3>
                  <p className="text-body-sm measure mt-1 text-[var(--foreground-muted)]">
                    {edition.tagline}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`${apiBase}${path}`}
                    className="text-label rounded-[var(--radius-chip)] border border-[var(--border)] px-3 py-2 text-[var(--foreground)] transition-colors hover:border-[var(--border-hover)]"
                  >
                    RSS
                  </a>
                  <Link
                    href={edition.slug ? `/${edition.slug}` : '/'}
                    className="text-label rounded-[var(--radius-chip)] px-2 py-2 text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
                  >
                    Read
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="border-t border-[var(--border)] py-9">
        <h2 className="text-display-md font-display mb-3 text-[var(--foreground)]">
          Email digests
        </h2>
        <p className="text-body-md measure text-[var(--foreground-muted)]">
          There aren&rsquo;t any yet. Rather than collect addresses for something
          that doesn&rsquo;t exist, we&rsquo;d point you at the feeds above —
          they carry everything an email digest would, without us holding your
          address.
        </p>
        <p className="text-body-md measure mt-4 text-[var(--foreground-muted)]">
          If email is something you want,{' '}
          <a
            href="https://github.com/emmanuelrichard01/ULTRA-NEWS/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline underline-offset-2"
          >
            say so on the issue tracker
          </a>
          .
        </p>
      </section>
    </div>
  );
}
