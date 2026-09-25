"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import BrandMark from './BrandMark';
import { ThemeToggle } from './ThemeToggle';
import { AskSparkle } from './AskTrigger';
import { useAsk } from './AskProvider';
import { EDITIONS, editionHref } from '@/lib/editions';
import { CATEGORY_MAP } from '@/lib/types';

/**
 * Masthead + section bar.
 *
 * Two bands with two jobs, modelled on the editorial portals in /inspo:
 *
 *   Masthead     the date, the nameplate centred, and the one action that
 *                matters (Ask). It scrolls away with the page — a nameplate is
 *                for arriving, and pinning 76px of it to every screen would
 *                spend the fold on branding.
 *   Section bar  editions and topics, sticky. This is where a reader goes
 *                next, so it stays. Once the masthead has scrolled off, the
 *                bar grows a compact brand mark on the left and an Ask button
 *                on the right, sliding in from the edges — the two things the
 *                masthead was carrying, handed over rather than lost.
 *
 * The editions used to live only inside the feed's own header, so on a story
 * page or a topic page there was no route between them without reaching the
 * footer. They are the product's real sections, so they lead the bar.
 *
 * Deliberately absent, as before: a keyword search box (Ask does that job
 * strictly better — it retrieves story clusters and answers with their
 * corroboration) and a "Subscribe" CTA for email digests that do not exist.
 */

const TOPICS = Object.entries(CATEGORY_MAP).map(([slug, info]) => ({
  slug,
  name: info.displayName,
  href: `/${slug}`,
}));

const SECONDARY = [
  { name: 'Sources', href: '/rss' },
  { name: 'How it works', href: '/about' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const pathname = usePathname();
  const { open: openAsk } = useAsk();
  const mastheadRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLUListElement>(null);

  // On a phone the section bar is wider than the screen, so the active item can
  // start off to the right — on /sports the reader could not see where they
  // were. Centre it, scrolling only the bar (scrollIntoView would also move
  // the page).
  useEffect(() => {
    const bar = barRef.current;
    const active = bar?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!bar || !active) return;
    bar.scrollTo({
      left: active.offsetLeft - bar.clientWidth / 2 + active.clientWidth / 2,
      behavior: 'smooth',
    });
  }, [pathname]);

  // Close the menu on navigation. Adjusting state during render rather than in
  // an effect avoids painting the new route with the menu still open.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsOpen(false);
  }

  // The bar is "stuck" once the masthead has left the viewport. An observer
  // rather than a scroll listener: it fires twice per crossing, not sixty
  // times a second.
  useEffect(() => {
    const el = mastheadRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The mobile sheet covers the page, so the page behind it should not scroll.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  return (
    <>
      {/* ------------------------------------------------------ masthead */}
      <div ref={mastheadRef} className="border-b border-[var(--border)]">
        <div className="mx-auto grid h-16 max-w-[var(--page-max)] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:h-[76px] sm:px-6">
          <div className="min-w-0">
            <TodayLine />
          </div>

          <Link
            href="/"
            aria-label="Ultra News — home"
            className="flex items-center justify-self-start transition-opacity hover:opacity-80 sm:justify-self-center"
          >
            {/* Visibility on wrappers: BrandMark sets its own display, and two
                display utilities on one element resolve by stylesheet order. */}
            <span className="hidden sm:block"><BrandMark size={26} /></span>
            <span className="sm:hidden"><BrandMark size={20} /></span>
          </Link>

          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => openAsk()}
              aria-label="Ask the wire room"
              className="pill pill-solid group hidden sm:inline-flex"
            >
              <AskSparkle className="shrink-0 transition-transform duration-500 group-hover:rotate-[18deg]" />
              Ask the wire
              <kbd className="font-data rounded-[5px] bg-white/15 px-1.5 py-0.5 text-[10px] tracking-wide">
                ⌘K
              </kbd>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* --------------------------------------------------- section bar */}
      <nav
        aria-label="Sections"
        data-stuck={stuck}
        className="group/bar sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--background)]/75"
      >
        <div className="mx-auto flex h-[var(--header-h)] max-w-[var(--page-max)] items-center gap-2 px-4 sm:px-6">
          {/* Compact mark. Collapsed to zero width at rest so it takes no room
              while the masthead is on screen, then slides in. */}
          <Link
            href="/"
            aria-label="Ultra News — home"
            tabIndex={stuck ? 0 : -1}
            aria-hidden={!stuck}
            className="flex w-0 shrink-0 -translate-x-2 items-center overflow-hidden opacity-0 transition-all duration-300 ease-[var(--ease-out)] group-data-[stuck=true]/bar:mr-2 group-data-[stuck=true]/bar:w-7 group-data-[stuck=true]/bar:translate-x-0 group-data-[stuck=true]/bar:opacity-100"
          >
            <BrandMark size={16} markOnly />
          </Link>

          {/* Fades at the edge on phones, so a bar that scrolls sideways looks
              like it does rather than like it simply ends. */}
          <ul
            ref={barRef}
            className="pb-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [mask-image:linear-gradient(to_right,#000_85%,transparent)] sm:[mask-image:none]"
          >
            {EDITIONS.map((edition) => (
              <BarLink
                key={edition.slug || 'wire'}
                href={editionHref(edition)}
                active={pathname === editionHref(edition)}
                strong
              >
                {edition.name}
              </BarLink>
            ))}
            <BarLink href="/briefing" active={pathname === '/briefing'} strong>
              <span className="flex items-center gap-1.5">
                <AskSparkle className="h-3 w-3 text-[var(--accent)]" />
                Briefing
              </span>
            </BarLink>
            <li aria-hidden="true" className="mx-2 h-4 w-px shrink-0 bg-[var(--border-strong)]" />
            {TOPICS.map((topic) => (
              <BarLink key={topic.slug} href={topic.href} active={pathname === topic.href}>
                {topic.name}
              </BarLink>
            ))}
          </ul>

          <div className="flex shrink-0 items-center gap-1 pl-1">
            {/* On desktop the masthead's Ask pill scrolls away with it; this
                one arrives as it goes. Phones use the floating Ask button
                (AskFab) instead — the top of the screen is out of thumb reach,
                and here it only crowded the topics. */}
            <button
              type="button"
              onClick={() => openAsk()}
              aria-label="Ask the wire room"
              className="ai-border hidden h-8 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--surface)] px-2.5 text-[var(--foreground)] transition-all duration-300 ease-[var(--ease-out)] sm:flex sm:pointer-events-none sm:translate-x-2 sm:opacity-0 sm:group-data-[stuck=true]/bar:pointer-events-auto sm:group-data-[stuck=true]/bar:translate-x-0 sm:group-data-[stuck=true]/bar:opacity-100"
              tabIndex={0}
            >
              <AskSparkle className="shrink-0 text-[var(--accent)]" />
              <span className="text-[13px]">Ask</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              className="-mr-1.5 p-2 text-[var(--foreground)] lg:hidden"
            >
              <div className="flex h-3.5 w-[18px] flex-col justify-between">
                <span className={`h-[1.5px] w-full origin-left bg-current transition-transform duration-300 ${isOpen ? 'translate-x-px rotate-45' : ''}`} />
                <span className={`h-[1.5px] w-full bg-current transition-opacity duration-200 ${isOpen ? 'opacity-0' : ''}`} />
                <span className={`h-[1.5px] w-full origin-left bg-current transition-transform duration-300 ${isOpen ? 'translate-x-px -rotate-45' : ''}`} />
              </div>
            </button>
          </div>
        </div>

        {/*
          Mobile sheet. Editions set large, because on a phone they are the
          whole navigation; topics and the secondary pages beneath.
        */}
        <div
          id="mobile-menu"
          hidden={!isOpen}
          className="animate-fade-in absolute inset-x-0 top-full h-[calc(100dvh-var(--header-h))] overflow-y-auto border-t border-[var(--border)] bg-[var(--background)] px-4 py-6 sm:px-6 lg:hidden"
        >
          <p className="eyebrow mb-3">Editions</p>
          <ul className="space-y-1">
            {EDITIONS.map((edition) => {
              const href = editionHref(edition);
              const active = pathname === href;
              return (
                <li key={edition.slug || 'wire'}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`block py-1 font-display text-[34px] leading-tight transition-colors ${
                      active ? 'text-[var(--foreground)]' : 'text-[var(--foreground-subtle)]'
                    }`}
                  >
                    {edition.name}
                  </Link>
                  <p className="text-body-sm mb-2 text-[var(--foreground-subtle)]">{edition.rubric}</p>
                </li>
              );
            })}
          </ul>

          <Link
            href="/briefing"
            className="mt-5 flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4"
          >
            <span>
              <span className="font-display block text-[26px] leading-tight text-[var(--foreground)]">The Briefing</span>
              <span className="text-body-sm text-[var(--foreground-subtle)]">Today&rsquo;s confirmed stories in two minutes</span>
            </span>
            <AskSparkle className="text-[var(--accent)]" />
          </Link>

          <div className="mt-6 border-t border-[var(--border)] pt-5">
            <p className="eyebrow mb-3">Topics</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {TOPICS.map((topic) => (
                <Link
                  key={topic.slug}
                  href={topic.href}
                  className={`text-body-md py-1.5 transition-colors ${
                    pathname === topic.href
                      ? 'text-[var(--foreground)]'
                      : 'text-[var(--foreground-muted)]'
                  }`}
                >
                  {topic.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-6 flex gap-5 border-t border-[var(--border)] pt-5">
            {SECONDARY.map((item) => (
              <Link key={item.href} href={item.href} className="text-body-sm text-[var(--foreground-muted)]">
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}

function BarLink({
  href,
  active,
  strong = false,
  children,
}: {
  href: string;
  active: boolean;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="shrink-0">
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`relative flex h-[var(--header-h)] items-center whitespace-nowrap px-2.5 text-[13px] transition-colors after:absolute after:inset-x-2.5 after:bottom-[-1px] after:h-[2px] after:origin-left after:rounded-full after:bg-[var(--foreground)] after:transition-transform after:duration-300 after:ease-[var(--ease-out)] ${
          active
            ? 'text-[var(--foreground)] after:scale-x-100'
            : 'text-[var(--foreground-muted)] after:scale-x-0 hover:text-[var(--foreground)] hover:after:scale-x-50'
        } ${strong ? 'font-medium' : ''}`}
      >
        {children}
      </Link>
    </li>
  );
}

/**
 * Today's date, as a broadsheet dateline.
 *
 * Rendered after mount: the page is statically generated and cached, so a
 * server-rendered date would be the build's date, not the reader's.
 */
function TodayLine() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);

  return (
    <div className="hidden leading-tight sm:block" aria-hidden={now === null}>
      <p className="text-[13px] font-medium text-[var(--foreground)]" suppressHydrationWarning>
        {now
          ? now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : ' '}
      </p>
      <p className="mt-0.5 text-[12px] text-[var(--foreground-subtle)]">
        Live wire · independent outlets, counted
      </p>
    </div>
  );
}
