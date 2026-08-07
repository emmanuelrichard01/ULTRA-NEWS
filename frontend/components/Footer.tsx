import Link from 'next/link';

import BrandMark from './BrandMark';
import { EDITIONS, editionHref } from '@/lib/editions';
import { CATEGORY_MAP } from '@/lib/types';

/**
 * Footer.
 *
 * Carries the editions and topics as a genuine sitemap rather than a row of
 * social icons, and states the attribution position plainly — a product built
 * entirely on other newsrooms' work should say so where everyone can see it.
 *
 * The editions column now states what each ordering does. A reader who has
 * reached the footer is, by definition, someone the feed did not hold; three
 * bare proper nouns at that point are three guesses, and "The Record" tells
 * nobody it means corroborated reporting by weight of evidence.
 *
 * This is also the only place in the product that explains what the
 * corroboration numbers mean without navigating to /about — see the legend
 * below. Every card in the feed carries a meter; nothing beside them said what
 * two bars rather than four was claiming.
 */

const ABOUT_LINKS = [
  { name: 'How it works', href: '/about' },
  // One RSS entry, not two. This column previously listed "Sources & RSS"
  // (/rss) and "Follow by RSS" (/subscribe) as separate destinations, which
  // reads as two features and is one.
  { name: 'Sources & RSS', href: '/rss' },
  { name: 'Privacy', href: '/privacy' },
  { name: 'Terms', href: '/terms' },
];

/**
 * What the meter is counting, in three rows.
 *
 * Deliberately states the evidence rather than a verdict, and the last line is
 * the one that matters most: a high count is not a truth score. Ten outlets can
 * repeat one mistaken wire report, and that is exactly what a corroboration
 * count looks like when it fails.
 */
const LEGEND = [
  { filled: 1, label: '1 outlet', meaning: 'Reported once. Not yet confirmed.' },
  { filled: 2, label: '2 outlets', meaning: 'A second newsroom has confirmed it.' },
  { filled: 4, label: '3+ outlets', meaning: 'Independently corroborated.' },
];

const TOPICS = Object.entries(CATEGORY_MAP).map(([slug, info]) => ({
  slug,
  name: info.displayName,
}));

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="inline-flex transition-opacity hover:opacity-80">
              <BrandMark size={17} />
            </Link>
            <p className="text-body-sm mt-3 max-w-xs text-[var(--foreground-muted)]">
              Coverage of the same event, grouped, with the number of independent
              outlets behind it.
            </p>

            {/* The legend. The meter appears on every card in the product and
                was never explained anywhere a reader would pass by. */}
            <ul className="mt-5 space-y-2">
              {LEGEND.map((row) => (
                <li key={row.label} className="flex items-center gap-2.5">
                  <span className="flex items-end gap-[2px]" aria-hidden="true">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className="w-[2.5px] rounded-[1px]"
                        style={{
                          height: `${5 + i * 2}px`,
                          backgroundColor:
                            i < row.filled
                              ? row.filled >= 3
                                ? 'var(--verified-teal)'
                                : row.filled === 2
                                ? 'var(--signal-amber)'
                                : 'var(--foreground-subtle)'
                              : 'var(--border)',
                        }}
                      />
                    ))}
                  </span>
                  <span className="font-data text-[11px] tabular-nums text-[var(--foreground-muted)]">
                    {row.label}
                  </span>
                  <span className="text-[11px] text-[var(--foreground-subtle)]">
                    {row.meaning}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <nav aria-labelledby="footer-editions">
            <h2 id="footer-editions" className="text-label mb-3 text-[var(--foreground-subtle)]">
              Editions
            </h2>
            <ul className="space-y-3">
              {EDITIONS.map((edition) => (
                <li key={edition.slug || 'wire'}>
                  <Link
                    href={editionHref(edition)}
                    className="text-body-sm block text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {edition.name}
                  </Link>
                  <span className="text-[11px] text-[var(--foreground-subtle)]">
                    {edition.rubric}
                  </span>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-topics">
            <h2 id="footer-topics" className="text-label mb-3 text-[var(--foreground-subtle)]">
              Topics
            </h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
              {TOPICS.map((topic) => (
                <li key={topic.slug}>
                  <Link
                    href={`/${topic.slug}`}
                    className="text-body-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {topic.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-about">
            <h2 id="footer-about" className="text-label mb-3 text-[var(--foreground-subtle)]">
              About
            </h2>
            <ul className="space-y-2">
              {ABOUT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-body-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://github.com/emmanuelrichard01/ULTRA-NEWS"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-body-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  Source code
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-body-sm text-[var(--foreground-subtle)]">
              Ultra News links to reporting; it does not republish it. All
              articles remain the work and property of the newsrooms that
              produced them.
            </p>
            {/*
              The limit of the method, stated where everyone passes it rather
              than only on /about. A product that puts a number on every
              headline owes the reader the sentence explaining what the number
              cannot do.
            */}
            <p className="text-body-sm text-[var(--foreground-subtle)]">
              A high corroboration count is not a truth score — outlets can
              repeat one mistaken report — and a low one is not a red flag:
              original reporting starts at a single newsroom by definition.
            </p>
          </div>
          <p className="font-data shrink-0 text-[11px] text-[var(--foreground-subtle)]">
            MIT licensed
          </p>
        </div>
      </div>
    </footer>
  );
}
