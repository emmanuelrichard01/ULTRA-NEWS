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

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div>
      <dt className="text-label text-[var(--foreground-subtle)]">{label}</dt>
      <dd className="font-data mt-1 text-[20px] tabular-nums text-[var(--foreground)]">
        {value}
      </dd>
      {note && (
        <dd className="mt-0.5 text-[11px] text-[var(--foreground-subtle)]">{note}</dd>
      )}
    </div>
  );
}

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

  /*
    Newsrooms, not feeds.

    This counted `new Set(sources.map(s => s.name))` — the rows themselves — so
    it reported one publisher per feed and the page read "Feeds 41 · Publishers
    41" however many feeds shared a newsroom. "BBC News" and "BBC World" are two
    feeds and one publisher, which is the distinction the entire product rests
    on, stated wrongly on the page that exists to explain what a source is.
  */
  const publishers = new Set(
    sources.map((s) => s.publisher_domain || s.name)
  ).size;
  const healthy = sources.filter((s) => s.health === 'active').length;
  const stale = sources.filter((s) => s.health === 'stale').length;
  const failing = sources.filter((s) => s.health === 'failing').length;

  // How often a feed is the FIRST to file on a story it belongs to. Already
  // computed by the backend and never surfaced — and it is the most
  // interesting thing this page can say, because it separates the newsrooms
  // that break stories from the ones that follow.
  const totalBrokenFirst = sources.reduce(
    (sum, s) => sum + (s.articles_broken_first || 0),
    0
  );

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

      {/*
        Four figures that each say something different.

        This previously ran "Healthy 0/41" beside "Failing 41" — two tiles
        restating one fact, and on a stale environment they combined into a
        wall that read as a broken site rather than a stale ingest. Health is
        now one tile with all three states in one line, and the space that
        freed goes to the count of stories these feeds broke first, which is
        the only figure here that says anything about the journalism.
      */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-b border-[var(--border)] py-7 sm:grid-cols-4">
        <Stat label="Feeds" value={sources.length.toLocaleString()} />
        <Stat
          label="Newsrooms"
          value={publishers.toLocaleString()}
          note={
            publishers < sources.length
              ? `${sources.length - publishers} feeds share a newsroom`
              : undefined
          }
        />
        <Stat
          label="Ingesting"
          value={`${healthy}/${sources.length}`}
          note={
            failing || stale
              ? [failing && `${failing} failing`, stale && `${stale} stale`]
                  .filter(Boolean)
                  .join(' · ')
              : 'all healthy'
          }
        />
        <Stat
          label="Broke first"
          value={totalBrokenFirst.toLocaleString()}
          note="stories filed before anyone else"
        />
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
        <p className="text-body-sm measure mt-1 text-[var(--foreground-muted)]">
          Tiers reflect how much a source contributes to clustering — wire
          services are syndicated widely and seed most clusters, regional outlets
          add geographic independence.
        </p>
        {/* The columns explained once, in prose, rather than in tooltips nobody
            on a phone can reach. */}
        <dl className="text-body-sm measure mb-6 mt-4 space-y-1.5 border-l-2 border-[var(--border-strong)] pl-4 text-[var(--foreground-subtle)]">
          <div>
            <dt className="inline font-semibold text-[var(--foreground-muted)]">
              Broke first —{' '}
            </dt>
            <dd className="inline">
              stories where this outlet filed before any other. Original
              reporting rather than pickup.
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold text-[var(--foreground-muted)]">
              Corroborated —{' '}
            </dt>
            <dd className="inline">
              share of this outlet&rsquo;s articles that reached three
              independent newsrooms.
            </dd>
          </div>
        </dl>

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
                  {/*
                    A table, because this is tabular data and it was being
                    rendered as a list of bare numbers.

                    Each row used to end with "1,284" and "37%" and a coloured
                    dot, with nothing on screen saying what any of them counted
                    — the only explanation lived in `title` attributes, which
                    never appear on touch, never appear for keyboard users, and
                    are not read out in most screen-reader modes. Column headers
                    state it once for every row, cost one line, and make the
                    numbers sortable by eye.
                  */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[34rem] border-collapse text-left">
                      <caption className="sr-only">
                        Tier {tier} sources: articles ingested, stories broken
                        first, corroboration rate and ingest health
                      </caption>
                      <thead>
                        <tr className="border-y border-[var(--border)]">
                          <th scope="col" className="text-label py-2 font-semibold text-[var(--foreground-subtle)]">
                            Outlet
                          </th>
                          <th scope="col" className="text-label py-2 text-right font-semibold text-[var(--foreground-subtle)]">
                            Articles
                          </th>
                          <th scope="col" className="text-label py-2 text-right font-semibold text-[var(--foreground-subtle)]">
                            Broke first
                          </th>
                          <th scope="col" className="text-label py-2 text-right font-semibold text-[var(--foreground-subtle)]">
                            Corroborated
                          </th>
                          <th scope="col" className="text-label py-2 pl-4 font-semibold text-[var(--foreground-subtle)]">
                            Ingest
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tierSources
                          .sort((a, b) => b.article_count - a.article_count)
                          .map((source) => (
                            <tr
                              key={source.url}
                              className="border-b border-[var(--border)] last:border-0"
                            >
                              <th scope="row" className="py-2.5 pr-4 font-normal">
                                <span className="text-body-md text-[var(--foreground)]">
                                  {source.name}
                                </span>
                                <span className="font-data ml-2 text-[11px] text-[var(--foreground-subtle)]">
                                  {source.region_label}
                                </span>
                              </th>
                              <td className="font-data py-2.5 text-right text-[12px] tabular-nums text-[var(--foreground-muted)]">
                                {source.article_count.toLocaleString()}
                              </td>
                              <td className="font-data py-2.5 text-right text-[12px] tabular-nums text-[var(--foreground-muted)]">
                                {source.articles_broken_first > 0
                                  ? source.articles_broken_first.toLocaleString()
                                  : '—'}
                              </td>
                              <td className="font-data py-2.5 text-right text-[12px] tabular-nums text-[var(--foreground-muted)]">
                                {source.corroboration_rate > 0
                                  ? `${source.corroboration_rate.toFixed(0)}%`
                                  : '—'}
                              </td>
                              <td className="py-2.5 pl-4">
                                <HealthDot health={source.health} />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
