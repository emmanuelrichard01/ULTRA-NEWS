"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { usePathname } from 'next/navigation';

const categories = [
  { name: 'Tech', href: '/tech' },
  { name: 'Politics', href: '/politics' },
  { name: 'Business', href: '/business' },
  { name: 'Science', href: '/science' },
  { name: 'Culture', href: '/entertainment' },
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
    <nav className="sticky top-0 z-50 bg-[var(--background)]/85 backdrop-blur-xl border-b border-[var(--border)] supports-[backdrop-filter]:bg-[var(--background)]/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          {/* Editorial Wordmark */}
          <Link href="/" className="flex items-center gap-2 group z-50 relative">
            <div className="w-6 h-6 bg-[var(--foreground)] flex items-center justify-center">
              <span className="text-[var(--background)] font-bold text-xs">U</span>
            </div>
            <span className="text-xl font-[900] tracking-tighter text-[var(--foreground)] uppercase font-display border-b-2 border-transparent group-hover:border-[var(--accent)] transition-all">
              Ultra<span className="text-[var(--foreground-muted)]">News</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {categories.map((cat) => (
              <Link
                key={cat.name}
                href={cat.href}
                className="text-sm font-bold uppercase tracking-wider text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
              >
                {cat.name}
              </Link>
            ))}
          </div>

          {/* Right Actions & Mobile Toggle */}
          <div className="flex items-center gap-4 z-50">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            <Link href="/subscribe" className="hidden sm:block text-xs font-bold uppercase tracking-widest text-[var(--item-foreground)] border border-[var(--foreground)] px-4 py-1.5 hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors">
              Subscribe
            </Link>

            {/* Mobile Burger */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden p-2 -mr-2 text-[var(--foreground)] hover:bg-[var(--foreground)]/5 rounded-full transition-colors"
              aria-label="Toggle Menu"
            >
              <div className="w-6 h-5 flex flex-col justify-between">
                <span className={`h-0.5 bg-current w-full transition-all duration-300 origin-left ${isOpen ? 'rotate-45 translate-x-px' : ''}`} />
                <span className={`h-0.5 bg-current w-full transition-all duration-300 ${isOpen ? 'opacity-0' : 'opacity-100'}`} />
                <span className={`h-0.5 bg-current w-full transition-all duration-300 origin-left ${isOpen ? '-rotate-45 translate-x-px' : ''}`} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div className={`fixed inset-0 bg-[var(--background)] z-40 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden flex flex-col pt-24 px-6 ${isOpen ? 'opacity-100 translate-y-0 visible' : 'opacity-0 -translate-y-4 invisible pointer-events-none'
        }`}>
        <div className="flex flex-col gap-6">
          {categories.map((cat, idx) => (
            <Link
              key={cat.name}
              href={cat.href}
              className={`text-4xl font-black tracking-tight text-[var(--foreground)] hover:text-[var(--accent-secondary)] transition-all duration-300 transform ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
              style={{ transitionDelay: `${idx * 50}ms` }}
            >
              {cat.name}
            </Link>
          ))}

          <div className="h-px bg-[var(--border)] my-4 w-full" />

          <div className="flex items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-widest text-[var(--foreground-muted)]">Theme</span>
            <ThemeToggle />
          </div>

          <Link href="/subscribe" className="mt-4 text-center w-full py-4 bg-[var(--foreground)] text-[var(--background)] font-bold uppercase tracking-widest">
            Subscribe Now
          </Link>
        </div>
      </div>
    </nav>
  );
}
