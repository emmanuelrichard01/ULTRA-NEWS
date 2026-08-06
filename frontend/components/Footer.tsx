import Link from 'next/link';

import { EDITIONS, editionHref } from '@/lib/editions';
import { CATEGORY_MAP } from '@/lib/types';

/**
 * Footer.
 *
 * Carries the editions and topics as a genuine sitemap rather than a row of
 * social icons, and states the attribution position plainly — a product built
 * entirely on other newsrooms' work should say so where everyone can see it.
 */

const ABOUT_LINKS = [
  { name: 'How it works', href: '/about' },
  { name: 'Sources & RSS', href: '/rss' },
  // Removed from the header, kept here: RSS is a real feature, but not a
  // primary call to action on a page that opens by saying email doesn't exist.
  { name: 'Follow by RSS', href: '/subscribe' },
  { name: 'Privacy', href: '/privacy' },
  { name: 'Terms', href: '/terms' },
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
            <span className="font-display text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
              Ultra<span className="text-[var(--foreground-subtle)]">News</span>
            </span>
            <p className="text-body-sm mt-2 max-w-xs text-[var(--foreground-muted)]">
              Coverage of the same event, grouped, with the number of independent
              outlets behind it.
            </p>
          </div>

          <nav aria-labelledby="footer-editions">
            <h2 id="footer-editions" className="text-label mb-3 text-[var(--foreground-subtle)]">
              Editions
            </h2>
            <ul className="space-y-2">
              {EDITIONS.map((edition) => (
                <li key={edition.slug || 'wire'}>
                  <Link
                    href={editionHref(edition)}
                    className="text-body-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {edition.name}
                  </Link>
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

        <div className="mt-12 flex flex-col gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body-sm max-w-2xl text-[var(--foreground-subtle)]">
            Ultra News links to reporting; it does not republish it. All articles
            remain the work and property of the newsrooms that produced them.
          </p>
          <p className="font-data shrink-0 text-[11px] text-[var(--foreground-subtle)]">
            MIT licensed
          </p>
        </div>
      </div>
    </footer>
  );
}
