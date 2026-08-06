import type { Metadata } from 'next';

import { fetchSources } from '@/lib/api';
import type { SourceInfo } from '@/lib/types';

/**
 * Sources — the ingest ledger, published.
 *
 * A product that asks readers to trust a corroboration count owes them the list
 * it counts from, including the parts that are failing. So this page shows
 * health honestly rather than as decoration: until recently four feeds — both
 * Tier-1 wire services among them — had been dead for the life of the registry
 * while rendering green, because a fetch failure was indistinguishable from a
 * quiet feed.
 *
 * It also documents the outbound feeds. Those were advertised here for months
 * and returned 404; they exist now.
 */

export const metadata: Metadata = {
  title: 'Sources',
  description:
    'Every feed Ultra News ingests, with live health, plus RSS feeds you can subscribe to.',
};

export const revalidate = 300;

const HEALTH: Record<SourceInfo['health'], { dot: string; label: string; title: string }> = {
  active: {
    dot: 'bg-[var(--verified-teal)]',
    label: 'Healthy',
    title: 'Fetched successfully within the last 6 hours.',
  },
  stale: {
    dot: 'bg-[var(--signal-amber)]',
    label: 'Stale',
    title: 'No successful fetch recently, or recovering from a failure.',
  },
  failing: {
    dot: 'bg-[var(--wire-red)]',
    label: 'Failing',
    title: 'Repeated failures, or no successful fetch in over 24 hours.',
  },
  pending: {
    dot: 'bg-[var(--foreground-subtle)]',
    label: 'Not yet fetched',
    title: 'Registered but not yet visited by an ingest cycle.',
  },
};

const TIER_NAMES: Record<number, string> = {
  1: 'Wire services',
  2: 'Major global outlets',
  3: 'Specialist',
  4: 'Regional',
};

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

function HealthDot({ health }: { health: SourceInfo['health'] }) {
  const { dot, label, title } = HEALTH[health] ?? HEALTH.failing;
  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      <span className="font-data text-[11px] text-[var(--foreground-muted)]">{label}</span>
    </span>
  );
}

export default async function SourcesPage() {
  const sources = await fetchSources();
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const publishers = new Set(sources.map((s) => s.name)).size;
  const healthy = sources.filter((s) => s.health === 'active').length;
  const failing = sources.filter((s) => s.health === 'failing').length;
  // Reported per-source in the registry below rather than as a headline number.
  // const totalArticles = sources.reduce((sum, s) => sum + s.article_count, 0);

  const byTier = new Map<number, SourceInfo[]>();
  sources.forEach((s) => {
    const tier = s.tier || 4;
    byTier.set(tier, [...(byTier.get(tier) ?? []), s]);
  });

  return (
    <div className="mx-auto max-w-4xl">
      <header className="border-b-2 border-[var(--foreground)] pb-7">
        <h1 className="text-display-2xl font-display text-[var(--foreground)]">Sources</h1>
        <p className="text-body-lg measure mt-3 text-[var(--foreground-muted)]">
          Every feed we ingest, and how each one is behaving right now. A
          corroboration count is only as good as the list it counts from, so the
          list is public — failures included.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-b border-[var(--border)] py-7 sm:grid-cols-4">
        {[
          { label: 'Feeds', value: sources.length.toLocaleString() },
          { label: 'Publishers', value: publishers.toLocaleString() },
          { label: 'Healthy', value: `${healthy}/${sources.length}` },
          { label: 'Failing', value: failing.toLocaleString() },
        ].map((stat) => (
          <div key={stat.label}>
            <dt className="text-label text-[var(--foreground-subtle)]">{stat.label}</dt>
            <dd className="font-data mt-1 text-[20px] tabular-nums text-[var(--foreground)]">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Subscribe */}
      <section aria-labelledby="feeds-heading" className="border-b border-[var(--border)] py-9">
        <h2 id="feeds-heading" className="text-display-md font-display text-[var(--foreground)]">
          Subscribe
        </h2>
        <p className="text-body-sm measure mb-5 mt-1 text-[var(--foreground-muted)]">
          One feed per edition. Every item states how many independent outlets
          stand behind the story, so corroboration survives into your reader.
        </p>

        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {OUTBOUND_FEEDS.map((feed) => (
            <li key={feed.path} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
              <div className="min-w-0">
                <span className="text-body-md font-display text-[var(--foreground)]">
                  {feed.name}
                </span>
                <p className="text-body-sm text-[var(--foreground-muted)]">{feed.description}</p>
              </div>
              <a
                href={`${apiBase}${feed.path}`}
                className="text-label shrink-0 rounded-[var(--radius-chip)] border border-[var(--border)] px-3 py-1.5 text-[var(--foreground-muted)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--foreground)]"
              >
                RSS
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Registry */}
      <section aria-labelledby="registry-heading" className="py-9">
        <h2 id="registry-heading" className="text-display-md font-display text-[var(--foreground)]">
          The registry
        </h2>
        <p className="text-body-sm measure mb-6 mt-1 text-[var(--foreground-muted)]">
          Tiers reflect how much a source contributes to clustering — wire
          services are syndicated widely and seed most clusters, regional outlets
          add geographic independence.
        </p>

        {sources.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 text-body-sm text-[var(--foreground-muted)]">
            The source registry is empty. Run <code className="font-data">make seed</code> to
            populate it.
          </p>
        ) : (
          <div className="space-y-8">
            {[...byTier.entries()]
              .sort(([a], [b]) => a - b)
              .map(([tier, tierSources]) => (
                <div key={tier}>
                  <h3 className="section-rule text-label mb-3 text-[var(--foreground-subtle)]">
                    Tier {tier} · {TIER_NAMES[tier] ?? 'Other'}
                  </h3>
                  <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {tierSources
                      .sort((a, b) => b.article_count - a.article_count)
                      .map((source) => (
                        <li
                          key={source.url}
                          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-body-md text-[var(--foreground)]">
                              {source.name}
                            </span>
                            <span className="font-data ml-2 text-[11px] text-[var(--foreground-subtle)]">
                              {source.region_label}
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-5">
                            <span
                              className="font-data text-[12px] tabular-nums text-[var(--foreground-muted)]"
                              title={`${source.article_count} articles ingested`}
                            >
                              {source.article_count.toLocaleString()}
                            </span>
                            {source.corroboration_rate > 0 && (
                              <span
                                className="font-data hidden text-[12px] tabular-nums text-[var(--foreground-muted)] sm:inline"
                                title="Share of this source's articles that reached three independent outlets"
                              >
                                {source.corroboration_rate.toFixed(0)}%
                              </span>
                            )}
                            <HealthDot health={source.health} />
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
