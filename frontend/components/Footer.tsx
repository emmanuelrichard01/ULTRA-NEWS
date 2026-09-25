import Link from 'next/link';

import { EDITIONS, editionHref } from '@/lib/editions';
import { CATEGORY_MAP } from '@/lib/types';

/**
 * The closing band.
 *
 * Set on the inverse ground, as the reference layouts do, so the page has an
 * unmistakable end — after an open-ended feed that matters. The nameplate is
 * set very large because this is the one place the brand gets room; the
 * masthead spends its space on the date and the action instead.
 *
 * Carries what nowhere else does: the meter legend (the meter appears on every
 * card and was never explained where a reader would pass), and the two
 * sentences on what the count cannot tell you.
 */

const ABOUT_LINKS = [
  { name: 'How it works', href: '/about' },
  { name: 'Sources & RSS', href: '/rss' },
  { name: 'Privacy', href: '/privacy' },
  { name: 'Terms', href: '/terms' },
];

const LEGEND = [
  { filled: 1, color: 'rgb(255 255 255 / 0.55)', label: '1 outlet', meaning: 'Reported once. Not yet confirmed.' },
  { filled: 2, color: 'var(--signal-amber)', label: '2 outlets', meaning: 'A second newsroom has confirmed it.' },
  { filled: 4, color: '#7fb6e6', label: '3+ outlets', meaning: 'Independently corroborated.' },
];

const TOPICS = Object.entries(CATEGORY_MAP).map(([slug, info]) => ({
  slug,
  name: info.displayName,
}));

function Column({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <nav aria-labelledby={id}>
      <h2 id={id} className="font-display mb-4 text-[22px] text-white">
        {title}
      </h2>
      {children}
    </nav>
  );
}

const linkClass = 'text-[14px] text-white/60 transition-colors hover:text-white';

export default function Footer() {
  return (
    // Fixed ink colours rather than tokens: this band is dark in BOTH themes,
    // so it must not flip when the page does.
    <footer className="mt-24 bg-[#0d0e10] text-white">
      <div className="mx-auto max-w-[var(--page-max)] px-4 pb-10 pt-16 sm:px-6">
        <div className="flex flex-col gap-10 border-b border-white/10 pb-12 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/" aria-label="Ultra News — home" className="inline-block">
              <span className="font-display block text-[clamp(3.5rem,11vw,8.5rem)] leading-[0.9] tracking-[-0.03em]">
                Ultra <span className="italic text-white/55">News</span>
              </span>
            </Link>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/60">
              Coverage of the same event, grouped — with the number of
              independent newsrooms standing behind it.
            </p>
          </div>
          <p className="font-display text-[26px] leading-tight text-white/85 lg:text-right">
            Every story, counted.
            <br />
            Every outlet, named.
          </p>
        </div>

        <div className="grid gap-12 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <section aria-labelledby="footer-legend">
            <h2 id="footer-legend" className="font-display mb-4 text-[22px] text-white">
              Reading the count
            </h2>
            <ul className="space-y-3">
              {LEGEND.map((row) => (
                <li key={row.label} className="flex items-center gap-3">
                  <span className="flex items-end gap-[2px]" aria-hidden="true">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className="w-[3px] rounded-[1px]"
                        style={{
                          height: `${6 + i * 2}px`,
                          backgroundColor: i < row.filled ? row.color : 'rgb(255 255 255 / 0.14)',
                        }}
                      />
                    ))}
                  </span>
                  <span className="font-data w-20 shrink-0 text-[12px] tabular-nums text-white/80">{row.label}</span>
                  <span className="text-[13px] text-white/50">{row.meaning}</span>
                </li>
              ))}
            </ul>
          </section>

          <Column id="footer-editions" title="Editions">
            <ul className="space-y-3">
              <li>
                <Link href="/briefing" className={`${linkClass} block`}>
                  The Briefing
                </Link>
                <span className="text-[12px] text-white/35">Today, confirmed, in two minutes</span>
              </li>
              {EDITIONS.map((edition) => (
                <li key={edition.slug || 'wire'}>
                  <Link href={editionHref(edition)} className={`${linkClass} block`}>
                    {edition.name}
                  </Link>
                  <span className="text-[12px] text-white/35">{edition.rubric}</span>
                </li>
              ))}
            </ul>
          </Column>

          <Column id="footer-topics" title="Topics">
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {TOPICS.map((topic) => (
                <li key={topic.slug}>
                  <Link href={`/${topic.slug}`} className={linkClass}>
                    {topic.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Column>

          <Column id="footer-about" title="About">
            <ul className="space-y-2.5">
              {ABOUT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.name}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://github.com/emmanuelrichard01/ULTRA-NEWS"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  Source code ↗
                </a>
              </li>
            </ul>
          </Column>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl space-y-2 text-[13px] leading-relaxed text-white/45">
            <p>
              Ultra News links to reporting; it does not republish it. All
              articles remain the work and property of the newsrooms that
              produced them.
            </p>
            {/* The limit of the method, stated where everyone passes it rather
                than only on /about. */}
            <p>
              A high corroboration count is not a truth score — outlets can
              repeat one mistaken report — and a low one is not a red flag:
              original reporting starts at a single newsroom by definition.
            </p>
          </div>
          <p className="font-data shrink-0 text-[11px] text-white/40">MIT licensed</p>
        </div>
      </div>
    </footer>
  );
}
