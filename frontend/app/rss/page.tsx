import { Metadata } from 'next';
import { fetchSources } from '@/lib/api';
import type { SourceInfo } from '@/lib/types';

export const metadata: Metadata = {
  title: "Sources & RSS Data Streams | Ultra News",
  description: "Live source registry showing all active news feeds powering Ultra News — organized by tier, with real-time health indicators.",
};

function HealthDot({ source }: { source: SourceInfo }) {
  const now = Date.now();
  const lastFetched = source.last_fetched_at ? new Date(source.last_fetched_at).getTime() : 0;
  const hoursSinceLastFetch = lastFetched ? (now - lastFetched) / (1000 * 60 * 60) : Infinity;

  let color = 'bg-[var(--verified-teal)]';
  let label = 'Active';

  if (source.consecutive_failures > 3 || hoursSinceLastFetch > 24) {
    color = 'bg-red-500';
    label = 'Failing';
  } else if (source.consecutive_failures > 0 || hoursSinceLastFetch > 6) {
    color = 'bg-[var(--signal-amber)]';
    label = 'Stale';
  }

  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="font-data text-[9px] text-[var(--foreground-muted)] uppercase tracking-wider">{label}</span>
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 font-data text-[9px] text-[var(--foreground-muted)] uppercase tracking-wider select-all cursor-pointer"
      title="Click to select URL"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
    </span>
  );
}

const TIER_ORDER = [1, 2, 3, 4] as const;
const TIER_DESCRIPTIONS: Record<number, string> = {
  1: "Wire services are the backbone of global news. Their copy gets syndicated to hundreds of outlets, making them the ideal seed for story clustering.",
  2: "High-volume general-interest outlets covering the same breaking events as wire services — critical for producing multi-source corroborated stories.",
  3: "Domain-specific outlets with deep coverage in tech, business, science, and other verticals.",
  4: "Regional outlets providing geographic diversity and local coverage.",
};

const TIER_COLORS: Record<number, string> = {
  1: 'var(--accent)',
  2: 'var(--verified-teal)',
  3: 'var(--signal-amber)',
  4: 'var(--foreground-muted)',
};

const OUTBOUND_FEEDS = [
  { name: "The Wire Feed", desc: "All stories — firehose intelligence stream.", endpoint: "/api/v1/feeds/wire.xml" },
  { name: "Developing Feed", desc: "Stories confirmed by 2+ independent sources.", endpoint: "/api/v1/feeds/developing.xml" },
  { name: "Reporting Feed", desc: "Verified stories — 3+ independent domains.", endpoint: "/api/v1/feeds/reporting.xml" },
];

export default async function RssPage() {
  const sources = await fetchSources();

  // Group by tier
  const grouped: Record<number, SourceInfo[]> = {};
  for (const s of sources) {
    const tier = s.tier || 4;
    if (!grouped[tier]) grouped[tier] = [];
    grouped[tier].push(s);
  }

  const totalActive = sources.filter(s => s.is_active).length;
  const totalArticles = sources.reduce((sum, s) => sum + s.article_count, 0);
  const tierCount = Object.keys(grouped).length;

  return (
    <div className="max-w-4xl mx-auto pt-8 pb-20 px-4">
      <header className="mb-12 border-b-2 border-[var(--foreground)] pb-8">
        <span className="text-xs font-bold tracking-widest uppercase text-[var(--accent)] mb-4 block">Source Infrastructure</span>
        <h1 className="text-4xl md:text-5xl font-display font-[900] tracking-tighter leading-none text-[var(--foreground)] mb-4">
          RSS Data Streams
        </h1>
        <p className="font-serif text-[18px] text-[var(--foreground-muted)] max-w-2xl leading-relaxed mb-6">
          Ultra News aggregates intelligence from {totalActive} active sources across {tierCount} tiers. Every source is monitored for health and reliability.
        </p>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-6 p-4 bg-[var(--surface-elevated)] rounded-[var(--radius-card)] border border-[var(--border)]">
          <div className="flex flex-col">
            <span className="font-data text-[22px] font-bold text-[var(--foreground)]">{totalActive}</span>
            <span className="font-data text-[9px] text-[var(--foreground-muted)] uppercase tracking-wider">Active Sources</span>
          </div>
          <div className="h-10 w-px bg-[var(--border)]" />
          <div className="flex flex-col">
            <span className="font-data text-[22px] font-bold text-[var(--foreground)]">{tierCount}</span>
            <span className="font-data text-[9px] text-[var(--foreground-muted)] uppercase tracking-wider">Tiers</span>
          </div>
          <div className="h-10 w-px bg-[var(--border)]" />
          <div className="flex flex-col">
            <span className="font-data text-[22px] font-bold text-[var(--foreground)]">{totalArticles.toLocaleString()}</span>
            <span className="font-data text-[9px] text-[var(--foreground-muted)] uppercase tracking-wider">Articles Ingested</span>
          </div>
          <div className="h-10 w-px bg-[var(--border)]" />
          <div className="flex flex-col">
            <span className="font-data text-[22px] font-bold text-[var(--foreground)]">
              {new Set(sources.map(s => s.region)).size}
            </span>
            <span className="font-data text-[9px] text-[var(--foreground-muted)] uppercase tracking-wider">Regions</span>
          </div>
        </div>
      </header>

      {/* Source Registry by Tier */}
      <section className="mb-16 space-y-10">
        <h2 className="font-data text-[12px] font-bold uppercase tracking-widest text-[var(--foreground)] mb-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--signal-amber)]"></span>
          Inbound Source Registry
        </h2>

        {TIER_ORDER.map(tier => {
          const tierSources = grouped[tier];
          if (!tierSources || tierSources.length === 0) return null;

          return (
            <div key={tier}>
              {/* Tier header */}
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full font-data text-[10px] font-bold text-white"
                  style={{ backgroundColor: TIER_COLORS[tier] }}
                >
                  {tier}
                </span>
                <div>
                  <h3 className="font-data text-[11px] font-bold uppercase tracking-wider text-[var(--foreground)]">
                    {tierSources[0]?.tier_label || `Tier ${tier}`}
                  </h3>
                  <p className="font-data text-[10px] text-[var(--foreground-muted)] max-w-lg">
                    {TIER_DESCRIPTIONS[tier]}
                  </p>
                </div>
                <span className="ml-auto font-data text-[10px] text-[var(--foreground-muted)]">
                  {tierSources.length} {tierSources.length === 1 ? 'source' : 'sources'}
                </span>
              </div>

              {/* Sources table */}
              <div className="bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-data text-[12px]">
                    <thead className="bg-[var(--surface-elevated)] text-[var(--foreground-muted)] border-b border-[var(--border)]">
                      <tr>
                        <th className="p-3 font-normal uppercase tracking-wider text-[10px]">Source</th>
                        <th className="p-3 font-normal uppercase tracking-wider text-[10px]">Region</th>
                        <th className="p-3 font-normal uppercase tracking-wider text-[10px]">Health</th>
                        <th className="p-3 font-normal uppercase tracking-wider text-[10px] text-right">Articles</th>
                        <th className="p-3 font-normal uppercase tracking-wider text-[10px] text-right">Corroboration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                      {tierSources.map((source) => (
                        <tr key={source.url} className="hover:bg-[var(--surface-elevated)] transition-colors">
                          <td className="p-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold">{source.name}</span>
                              <span className="font-mono text-[9px] text-[var(--foreground-muted)] truncate max-w-[200px]">
                                {source.url}
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 bg-[var(--surface-elevated)] border border-[var(--border)] px-2 py-0.5 rounded-sm text-[10px] text-[var(--foreground-muted)]">
                              {source.region_label}
                            </span>
                          </td>
                          <td className="p-3">
                            <HealthDot source={source} />
                          </td>
                          <td className="p-3 text-right font-bold">
                            {source.article_count}
                          </td>
                          <td className="p-3 text-right">
                            <span className={source.corroboration_rate > 0 ? 'text-[var(--verified-teal)] font-bold' : 'text-[var(--foreground-muted)]'}>
                              {source.corroboration_rate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Outbound Subscriptions */}
      <section>
        <h2 className="font-data text-[12px] font-bold uppercase tracking-widest text-[var(--foreground)] mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--verified-teal)]"></span>
          Outbound Subscriptions
          <span className="ml-2 font-data text-[9px] font-normal text-[var(--foreground-muted)] bg-[var(--surface-elevated)] border border-[var(--border)] px-2 py-0.5 rounded-sm uppercase tracking-wider">
            Coming Soon
          </span>
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {OUTBOUND_FEEDS.map(feed => (
            <div key={feed.name} className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-card)] p-5 relative group overflow-hidden opacity-60 hover:opacity-80 transition-opacity">
              <div className="absolute top-0 left-0 w-full h-1 bg-[var(--border)] group-hover:bg-[var(--verified-teal)] transition-colors"></div>
              <h3 className="font-display font-bold text-[16px] text-[var(--foreground)] mb-2 mt-2">{feed.name}</h3>
              <p className="font-serif text-[13px] text-[var(--foreground-muted)] mb-6">{feed.desc}</p>

              <div className="bg-[var(--background)] px-3 py-2 rounded-[var(--radius-chip)] border border-[var(--border)]">
                <code className="font-data text-[10px] text-[var(--foreground)] truncate block select-all">
                  {feed.endpoint}
                </code>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
