import type { Metadata } from 'next';

import SourceDirectory from '@/components/SourceDirectory';
import { fetchSources } from '@/lib/api';
import { ArrowRight } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Sources',
  description:
    'Every feed Ultra News ingests, with live health, plus RSS feeds you can subscribe to.',
};

export const revalidate = 300;

/**
 * Outbound feeds, one per edition. These existed in the backend and were
 * advertised in the metadata long before any page linked to them.
 */
const OUTBOUND_FEEDS = [
  {
    name: 'The Wire',
    description: 'Every story as it lands.',
    path: '/api/v1/feeds/wire.xml',
  },
  {
    name: 'Developing',
    description: 'Stories with two or more independent outlets.',
    path: '/api/v1/feeds/developing.xml',
  },
  {
    name: 'The Record',
    description: 'Corroborated by three or more independent outlets.',
    path: '/api/v1/feeds/record.xml',
  },
];

export default async function SourcesPage() {
  const sources = await fetchSources();
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  /*
    Newsrooms, not feeds.

    This once counted `new Set(sources.map(s => s.name))` — the rows themselves
    — so it reported one publisher per feed. "BBC News" and "BBC World" are two
    feeds and one publisher, which is the distinction the entire product rests
    on, stated wrongly on the page that exists to explain what a source is.
  */
  const publishers = new Set(sources.map((s) => s.publisher_domain || s.name)).size;
  const healthy = sources.filter((s) => s.health === 'active').length;
  const stale = sources.filter((s) => s.health === 'stale').length;
  const failing = sources.filter((s) => s.health === 'failing').length;
  const pending = sources.length - healthy - stale - failing;
  const regions = new Set(sources.map((s) => s.region_label).filter(Boolean)).size;

  // How often a feed is the FIRST to file on a story it belongs to — the one
  // figure here that separates newsrooms that break stories from those that
  // follow.
  const totalBrokenFirst = sources.reduce((sum, s) => sum + (s.articles_broken_first || 0), 0);

  const healthBar = [
    { label: 'Healthy', value: healthy, color: 'var(--verified-teal)' },
    { label: 'Stale', value: stale, color: 'var(--signal-amber)' },
    { label: 'Failing', value: failing, color: 'var(--wire-red)' },
    { label: 'Not yet fetched', value: pending, color: 'var(--border-strong)' },
  ].filter((h) => h.value > 0);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="grid gap-8 border-b border-[var(--border)] pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
        <div>
          <p className="eyebrow mb-4">The registry · public, failures included</p>
          <h1 className="text-display-2xl font-display animate-fade-in-up text-[var(--foreground)]">
            Every source, <span className="italic text-[var(--foreground-muted)]">counted.</span>
          </h1>
          <p className="text-body-lg measure mt-4 text-[var(--foreground-muted)]">
            A corroboration count is only as good as the list it counts from, so
            the list is public — with how each feed is behaving right now.
          </p>
        </div>

        {/*
          Four figures that each say something different. Health is one tile
          with a distribution bar, rather than "Healthy 0/41" beside "Failing
          41" — two tiles restating one fact, which on a stale environment read
          as a broken site rather than a stale ingest.
        */}
        <dl className="grid grid-cols-2 gap-3">
          <Figure
            label="Newsrooms"
            value={publishers}
            note={
              publishers < sources.length
                ? `from ${sources.length} feeds — ${sources.length - publishers} share a newsroom`
                : `${sources.length} feeds`
            }
          />
          <Figure label="Regions" value={regions} note="geographic independence" />
          <Figure label="Broke first" value={totalBrokenFirst} note="stories filed before anyone else" />
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
            <dt className="text-[12px] text-[var(--foreground-subtle)]">Ingesting</dt>
            <dd className="font-display mt-1 text-[34px] leading-none text-[var(--foreground)]">
              {healthy}
              <span className="text-[20px] text-[var(--foreground-subtle)]">/{sources.length}</span>
            </dd>
            <dd className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]" aria-hidden="true">
              {healthBar.map((h) => (
                <span
                  key={h.label}
                  style={{ width: `${(h.value / Math.max(sources.length, 1)) * 100}%`, backgroundColor: h.color }}
                />
              ))}
            </dd>
            <dd className="mt-1.5 text-[11px] text-[var(--foreground-subtle)]">
              {healthBar.map((h) => `${h.value} ${h.label.toLowerCase()}`).join(' · ') || 'no feeds'}
            </dd>
          </div>
        </dl>
      </header>

      <section aria-labelledby="feeds-heading" className="border-b border-[var(--border)] py-12">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="feeds-heading" className="text-display-lg font-display text-[var(--foreground)]">
              Subscribe by RSS
            </h2>
          </div>
          <p className="text-body-sm max-w-sm text-[var(--foreground-muted)] sm:text-right">
            Every item states how many independent outlets stand behind the
            story, so corroboration survives into your reader.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {OUTBOUND_FEEDS.map((feed) => (
            <li key={feed.path}>
              <a
                href={`${apiBase}${feed.path}`}
                className="group card-lift flex h-full flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5"
              >
                <span className="flex items-center justify-between">
                  <span className="font-display text-[26px] leading-tight text-[var(--foreground)]">{feed.name}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="text-[var(--accent-secondary)]">
                    <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
                    <circle cx="5" cy="19" r="1.2" fill="currentColor" />
                  </svg>
                </span>
                <span className="text-body-sm mt-1 text-[var(--foreground-muted)]">{feed.description}</span>
                <span className="font-data mt-4 inline-flex items-center gap-1.5 text-[11px] text-[var(--foreground-subtle)] group-hover:text-[var(--foreground)]">
                  RSS feed <ArrowRight className="nudge-arrow" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="registry-heading" className="py-12">
        <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <h2 id="registry-heading" className="text-display-lg font-display text-[var(--foreground)]">
              Who we read, and how it&rsquo;s going
            </h2>
          </div>
          {/* The columns explained once, in prose, rather than in tooltips
              nobody on a phone can reach. */}
          <dl className="text-body-sm space-y-1.5 border-l border-[var(--border-strong)] pl-4 text-[var(--foreground-subtle)]">
            <div>
              <dt className="inline font-semibold text-[var(--foreground-muted)]">Broke first — </dt>
              <dd className="inline">stories where this outlet filed before any other.</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-[var(--foreground-muted)]">Corroborated — </dt>
              <dd className="inline">share of its articles that reached three independent newsrooms.</dd>
            </div>
          </dl>
        </div>

        {sources.length === 0 ? (
          <p className="text-body-sm rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--foreground-muted)]">
            The source registry is empty. Run <code className="font-data">make seed</code> to populate it.
          </p>
        ) : (
          <SourceDirectory sources={sources} />
        )}
      </section>
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
      <dt className="text-[12px] text-[var(--foreground-subtle)]">{label}</dt>
      <dd className="font-display mt-1 text-[34px] leading-none tabular-nums text-[var(--foreground)]">
        {value.toLocaleString()}
      </dd>
      {note && <dd className="mt-2 text-[11px] leading-snug text-[var(--foreground-subtle)]">{note}</dd>}
    </div>
  );
}
