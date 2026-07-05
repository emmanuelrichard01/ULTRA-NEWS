"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { usePathname } from 'next/navigation';

const primaryViews = [
  { name: 'The Wire', href: '/' },
  { name: 'Developing', href: '/developing' },
  { name: 'Reporting', href: '/reporting' },
];

const topics = [
  { name: 'Tech', href: '/tech' },
  { name: 'Politics', href: '/politics' },
  { name: 'Business', href: '/business' },
  { name: 'Science', href: '/science' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  return (
    <nav className={`sticky top-0 z-50 border-b border-[var(--border)] transition-colors duration-300 ${isOpen
      ? "bg-[var(--background)]"
      : "bg-[var(--background)]/90 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--background)]/70"
      }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          {/* V3 Mono Wordmark */}
          <Link href="/" className="flex items-center gap-2 group z-50 relative">
            <div className="w-7 h-7 relative flex items-center justify-center">
              <img src="/images/logo-light-mode.png" alt="Logo" className="absolute inset-0 w-full h-full object-contain dark:hidden" />
              <img src="/images/logo-dark-mode.png" alt="Logo" className="absolute inset-0 w-full h-full object-contain hidden dark:block" />
            </div>
            <span className="font-data text-lg font-bold tracking-tight text-[var(--foreground)] uppercase">
              ULTRA<span className="text-[var(--foreground-muted)]">·</span><span className="text-[var(--foreground-muted)]">NEWS</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-7">
            {primaryViews.map((view) => {
              const isActive = pathname === view.href;
              return (
                <Link
                  key={view.name}
                  href={view.href}
                  className={`font-data text-[11px] font-semibold uppercase tracking-wider transition-colors duration-150 relative ${
                    isActive
                      ? "text-[var(--foreground)]"
                      : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {view.name}
                  {isActive && <span className="absolute -bottom-4 left-0 w-full h-[2px] bg-[var(--foreground)]" />}
                </Link>
              );
            })}

            {/* Topics Dropdown */}
            <div className="relative group py-4">
              <button className="font-data text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-150 flex items-center gap-1">
                Topics
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <div className="absolute top-full left-0 w-40 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-card)] p-2 shadow-xl flex flex-col gap-1">
                  {topics.map((topic) => (
                    <Link
                      key={topic.name}
                      href={topic.href}
                      className="px-3 py-2 text-sm font-display text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] rounded-md transition-colors"
                    >
                      {topic.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3 z-50">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            <Link
              href="/subscribe"
              className="hidden sm:block font-data text-[10px] font-bold uppercase tracking-widest text-[var(--foreground)] border border-[var(--foreground)] px-4 py-1.5 rounded-[var(--radius-chip)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors duration-150"
            >
              Subscribe
            </Link>

            {/* Mobile Burger */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden p-2 -mr-2 text-[var(--foreground)] hover:bg-[var(--surface-elevated)] rounded-[var(--radius-chip)] transition-colors"
              aria-label="Toggle Menu"
            >
              <div className="w-5 h-4 flex flex-col justify-between">
                <span className={`h-0.5 bg-current w-full transition-all duration-300 origin-left ${isOpen ? 'rotate-45 translate-x-px' : ''}`} />
                <span className={`h-0.5 bg-current w-full transition-all duration-300 ${isOpen ? 'opacity-0' : 'opacity-100'}`} />
                <span className={`h-0.5 bg-current w-full transition-all duration-300 origin-left ${isOpen ? '-rotate-45 translate-x-px' : ''}`} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`fixed inset-0 bg-[var(--background)] z-40 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden flex flex-col pt-24 px-6 ${isOpen ? 'opacity-100 translate-y-0 visible' : 'opacity-0 -translate-y-4 invisible pointer-events-none'
        }`}>
        <div className="flex flex-col gap-6">
          {primaryViews.map((view, idx) => (
            <Link
              key={view.name}
              href={view.href}
              className={`text-3xl font-display font-bold tracking-tight text-[var(--foreground)] hover:text-[var(--accent)] transition-all duration-300 transform ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
              style={{ transitionDelay: `${idx * 50}ms` }}
            >
              {view.name}
            </Link>
          ))}

          <div className="h-px bg-[var(--border)] my-2 w-full" />
          
          <div className="grid grid-cols-2 gap-4">
            {topics.map((topic, idx) => (
              <Link
                key={topic.name}
                href={topic.href}
                className={`text-lg font-display text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all duration-300 transform ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                  }`}
                style={{ transitionDelay: `${(idx + primaryViews.length) * 50}ms` }}
              >
                {topic.name}
              </Link>
            ))}
          </div>

          <div className="h-px bg-[var(--border)] my-4 w-full" />

          <div className="flex items-center justify-between">
            <span className="font-data text-[11px] font-bold uppercase tracking-widest text-[var(--foreground-muted)]">Theme</span>
            <ThemeToggle />
          </div>

          <Link href="/subscribe" className="mt-4 text-center w-full py-4 bg-[var(--foreground)] text-[var(--background)] font-data font-bold uppercase tracking-widest text-sm rounded-[var(--radius-card)]">
            Subscribe
          </Link>
        </div>
      </div>
    </nav>
  );
}
