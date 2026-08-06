import Link from 'next/link';

import { EDITIONS, editionHref, type Edition } from '@/lib/editions';

/**
 * Edition switcher.
 *
 * Rendered as a masthead rule rather than tabs, because these are three
 * editions of one publication, not three sections of an app. The active one
 * carries a heavy underline the way a broadsheet marks its current section.
 */
export default function EditionNav({ current }: { current: Edition }) {
  return (
    <nav aria-label="Editions" className="mb-6 border-b border-[var(--border)]">
      <ul className="-mb-px flex items-end gap-6 sm:gap-8">
        {EDITIONS.map((edition) => {
          const isActive = edition.slug === current.slug;
          return (
            <li key={edition.slug || 'wire'}>
              <Link
                href={editionHref(edition)}
                aria-current={isActive ? 'page' : undefined}
                className={`block border-b-2 pb-2.5 font-display text-[15px] tracking-tight transition-colors sm:text-[17px] ${
                  isActive
                    ? 'border-[var(--foreground)] text-[var(--foreground)]'
                    : 'border-transparent text-[var(--foreground-subtle)] hover:text-[var(--foreground)]'
                }`}
              >
                {edition.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
