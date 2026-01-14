import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

const categories = [
  { name: 'Tech', href: '/tech' },
  { name: 'Politics', href: '/politics' },
  { name: 'Business', href: '/business' },
  { name: 'Science', href: '/science' },
  { name: 'Culture', href: '/entertainment' },
];

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          {/* Editorial Wordmark */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-6 h-6 bg-[var(--foreground)] flex items-center justify-center">
              <span className="text-[var(--background)] font-bold text-xs">U</span>
            </div>
            <span className="text-xl font-[900] tracking-tighter text-[var(--foreground)] uppercase font-display border-b-2 border-transparent group-hover:border-[var(--accent)] transition-all">
              Ultra<span className="text-[var(--foreground-muted)]">News</span>
            </span>
          </Link>

          {/* Minimal Navigation */}
          <div className="hidden lg:flex items-center gap-6">
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

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/subscribe" className="hidden sm:block text-xs font-bold uppercase tracking-widest text-[var(--item-foreground)] border border-[var(--foreground)] px-3 py-1.5 hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors">
              Subscribe
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
