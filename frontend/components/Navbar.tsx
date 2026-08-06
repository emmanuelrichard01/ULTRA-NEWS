"use client";

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

import { ThemeToggle } from './ThemeToggle';
import { CATEGORY_MAP } from '@/lib/types';

/**
 * Navbar.
 *
 * The primary nav used to be three pipeline tiers — The Wire / Developing /
 * Reporting — which put 95% of content behind one link and left the other two
 * near-empty. Editions now live in their own masthead rule inside the feed, so
 * this carries only what sits outside them.
 *
 * The keyword search box is gone too. It duplicated Ask the Wire Room while
 * being strictly worse at the same job: keyword search matches article text,
 * whereas Ask retrieves whole story clusters and answers with the corroboration
 * attached. Two search affordances in one header, one of them weaker, is a
 * choice the reader shouldn't have to make.
 *
 * And the "Subscribe" CTA. It was the most prominent element in the header —
 * bordered, right-aligned, styled as the primary action — pointing at a page
 * that now says email digests don't exist. A label promising signup should not
 * lead somewhere that opens by declining. RSS remains discoverable from Sources
 * (which lists the same feeds) and from the footer, which is proportionate to
 * what it is.
 */

const TOPICS = Object.entries(CATEGORY_MAP).map(([slug, info]) => ({
  slug,
  name: info.displayName,
  href: `/${slug}`,
}));

// Editions live in their own masthead rule inside the feed, so the global nav
// carries only what sits outside them.
const PRIMARY = [
  { name: 'Sources', href: '/rss' },
  { name: 'About', href: '/about' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close the menu on navigation. Adjusting state during render rather than in
  // an effect avoids painting the new route with the menu still open.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsOpen(false);
  }

  const isTopicActive = TOPICS.some((t) => t.href === pathname);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Wordmark */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="font-display text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
            Ultra
            <span className="text-[var(--foreground-subtle)]">News</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
          {PRIMARY.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`text-body-sm transition-colors ${
                  active
                    ? 'text-[var(--foreground)]'
                    : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {item.name}
              </Link>
            );
          })}

          {/* Topics — a details/summary disclosure so it works without hover,
              which the old CSS-hover dropdown did not on touch devices. */}
          <details className="group relative">
            <summary
              className={`text-body-sm flex cursor-pointer list-none items-center gap-1 transition-colors marker:content-[''] ${
                isTopicActive
                  ? 'text-[var(--foreground)]'
                  : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Topics
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="transition-transform group-open:rotate-180" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <div className="absolute left-0 top-full z-50 mt-3 w-52 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 shadow-[var(--shadow-lg)]">
              {TOPICS.map((topic) => (
                <Link
                  key={topic.slug}
                  href={topic.href}
                  className={`block rounded-[var(--radius-chip)] px-3 py-2 text-body-sm transition-colors ${
                    pathname === topic.href
                      ? 'bg-[var(--surface)] text-[var(--foreground)]'
                      : 'text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {topic.name}
                </Link>
              ))}
            </div>
          </details>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            className="-mr-2 p-2 text-[var(--foreground)] lg:hidden"
          >
            <div className="flex h-4 w-5 flex-col justify-between">
              <span className={`h-[1.5px] w-full origin-left bg-current transition-transform duration-300 ${isOpen ? 'translate-x-px rotate-45' : ''}`} />
              <span className={`h-[1.5px] w-full bg-current transition-opacity duration-200 ${isOpen ? 'opacity-0' : ''}`} />
              <span className={`h-[1.5px] w-full origin-left bg-current transition-transform duration-300 ${isOpen ? 'translate-x-px -rotate-45' : ''}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        hidden={!isOpen}
        className="border-t border-[var(--border)] bg-[var(--background)] px-4 py-6 sm:px-6 lg:hidden"
      >
        <nav aria-label="Mobile" className="space-y-1">
          {PRIMARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block py-2 text-display-md font-display transition-colors ${
                pathname === item.href
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--foreground)]'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="mt-6 border-t border-[var(--border)] pt-5">
          <p className="text-label mb-3 text-[var(--foreground-subtle)]">Topics</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {TOPICS.map((topic) => (
              <Link
                key={topic.slug}
                href={topic.href}
                className={`py-1.5 text-body-sm transition-colors ${
                  pathname === topic.href
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--foreground-muted)]'
                }`}
              >
                {topic.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
