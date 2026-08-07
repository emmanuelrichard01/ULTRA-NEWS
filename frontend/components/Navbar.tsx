"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import BrandMark from './BrandMark';
import { ThemeToggle } from './ThemeToggle';
import { AskSparkle } from './AskTrigger';
import { useAsk } from './AskProvider';
import { EDITIONS, editionHref } from '@/lib/editions';
import { CATEGORY_MAP } from '@/lib/types';

/**
 * Navbar.
 *
 * Deliberately thin. The three editions are the product's real sections, and
 * they have their own masthead inside the feed — setting them here as well
 * would mean the page named its current section twice, in two type sizes, one
 * above the other. So the header carries only what sits outside the editions,
 * plus the two controls that have to work on every route.
 *
 * Ask is one of them. It used to exist solely on feed pages, because the modal
 * lived in FeedPage; a reader on a story page had no way to ask anything and
 * the advertised ⌘K did nothing. It now comes from AskProvider in the layout,
 * so the control and the shortcut behave identically everywhere.
 *
 * What is deliberately absent: a keyword search box. It duplicated Ask while
 * being strictly worse at the same job — keyword search matches article text,
 * whereas Ask retrieves whole story clusters and answers with the corroboration
 * attached. And a "Subscribe" CTA, which was once the most prominent element in
 * the header, styled as the primary action, pointing at a page that opens by
 * explaining that email digests do not exist.
 */

const TOPICS = Object.entries(CATEGORY_MAP).map(([slug, info]) => ({
  slug,
  name: info.displayName,
  href: `/${slug}`,
}));

const PRIMARY = [
  { name: 'Sources', href: '/rss' },
  { name: 'About', href: '/about' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const pathname = usePathname();
  const { open: openAsk } = useAsk();

  // Close the menu on navigation. Adjusting state during render rather than in
  // an effect avoids painting the new route with the menu still open.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsOpen(false);
    setTopicsOpen(false);
  }

  // The mobile sheet covers the page, so the page behind it should not scroll.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const isTopicActive = TOPICS.some((t) => t.href === pathname);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="Ultra News — home"
          className="flex shrink-0 items-center transition-opacity hover:opacity-80"
        >
          <BrandMark size={17} />
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

          {/*
            Topics. A real menu rather than the previous <details> disclosure,
            which stayed open when the reader clicked away or pressed Escape —
            leaving a panel covering the page it had just navigated to. Same
            behaviour as the feed's TopicFilter, so the two controls that list
            the same nine topics also dismiss the same way.
          */}
          <TopicsMenu
            isOpen={topicsOpen}
            setIsOpen={setTopicsOpen}
            isActive={isTopicActive}
            pathname={pathname}
          />
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={openAsk}
            aria-label="Ask the wire room"
            className="ai-border flex items-center gap-2 rounded-[var(--radius-card)] bg-[var(--surface)] px-2.5 py-1.5 transition-colors hover:bg-[var(--surface-elevated)]"
          >
            <AskSparkle className="shrink-0 text-[var(--accent)]" />
            <span className="text-body-sm hidden text-[var(--foreground-muted)] sm:inline">
              Ask
            </span>
            <kbd className="font-data hidden rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] text-[var(--foreground-subtle)] md:inline-block">
              ⌘K
            </kbd>
          </button>

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

      {/*
        Mobile sheet.

        Carries the editions, which the desktop header does not. On a phone the
        feed's masthead scrolls away with the page, so without them here a
        reader partway down a story has no route between editions at all — the
        desktop equivalent is at least one scroll from the footer.
      */}
      <div
        id="mobile-menu"
        hidden={!isOpen}
        className="max-h-[calc(100vh-3.5rem)] overflow-y-auto border-t border-[var(--border)] bg-[var(--background)] px-4 py-6 sm:px-6 lg:hidden"
      >
        <nav aria-label="Editions">
          <p className="text-label mb-3 text-[var(--foreground-subtle)]">Editions</p>
          <ul className="space-y-1">
            {EDITIONS.map((edition) => {
              const href = editionHref(edition);
              const active = pathname === href;
              return (
                <li key={edition.slug || 'wire'}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`block py-1.5 font-display text-[22px] tracking-tight transition-colors ${
                      active
                        ? 'text-[var(--foreground)]'
                        : 'text-[var(--foreground-subtle)]'
                    }`}
                  >
                    {edition.name}
                  </Link>
                  <p className="text-body-sm mb-1 text-[var(--foreground-subtle)]">
                    {edition.rubric}
                  </p>
                </li>
              );
            })}
          </ul>
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

        <nav
          aria-label="Secondary"
          className="mt-6 flex gap-5 border-t border-[var(--border)] pt-5"
        >
          {PRIMARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-body-sm text-[var(--foreground-muted)]"
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function TopicsMenu({
  isOpen,
  setIsOpen,
  isActive,
  pathname,
}: {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  isActive: boolean;
  pathname: string;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-topics-menu]')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [isOpen, setIsOpen]);

  return (
    <div className="relative" data-topics-menu>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={`text-body-sm flex items-center gap-1 transition-colors ${
          isActive || isOpen
            ? 'text-[var(--foreground)]'
            : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
        }`}
      >
        Topics
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="animate-fade-in-up absolute left-0 top-full z-50 mt-3 w-52 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 shadow-[var(--shadow-lg)]"
        >
          {TOPICS.map((topic) => (
            <Link
              key={topic.slug}
              href={topic.href}
              role="menuitem"
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
      )}
    </div>
  );
}
