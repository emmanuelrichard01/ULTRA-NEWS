"use client";

import { useMemo, useState } from 'react';

import type { SourceInfo } from '@/lib/types';
import { ArrowDown } from '@/components/icons';

/**
 * The source registry, searchable and sortable.
 *
 * Forty-plus feeds in four tier tables was readable but not usable: "is the
 * Guardian in here?" meant scanning four tables, and "which feeds are
 * failing?" meant reading every row's dot. Search, a health filter and
 * column sorting answer both in one gesture. Everything is client-side over
 * data already on the page — the registry is small and changes slowly.
 */

const HEALTH: Record<SourceInfo['health'], { dot: string; label: string; title: string }> = {
  active: { dot: 'bg-[var(--verified-teal)]', label: 'Healthy', title: 'Fetched successfully within the last 6 hours.' },
  stale: { dot: 'bg-[var(--signal-amber)]', label: 'Stale', title: 'No successful fetch recently, or recovering from a failure.' },
  failing: { dot: 'bg-[var(--wire-red)]', label: 'Failing', title: 'Repeated failures, or no successful fetch in over 24 hours.' },
  pending: { dot: 'bg-[var(--foreground-subtle)]', label: 'Not yet fetched', title: 'Registered but not yet visited by an ingest cycle.' },
};

const TIER_NAMES: Record<number, string> = {
  1: 'Wire services',
  2: 'Major global',
  3: 'Specialist',
  4: 'Regional',
};

type SortKey = 'name' | 'article_count' | 'articles_broken_first' | 'corroboration_rate';

export default function SourceDirectory({ sources }: { sources: SourceInfo[] }) {
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<number | 'all'>('all');
  const [health, setHealth] = useState<SourceInfo['health'] | 'all'>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'article_count', dir: -1 });

  const tiers = useMemo(() => [...new Set(sources.map((s) => s.tier || 4))].sort(), [sources]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sources
      .filter((s) => (tier === 'all' ? true : (s.tier || 4) === tier))
      .filter((s) => (health === 'all' ? true : s.health === health))
      .filter((s) =>
        q
          ? [s.name, s.region_label, s.publisher_domain].some((v) => v?.toLowerCase().includes(q))
          : true
      )
      .sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * sort.dir;
        return ((Number(av) || 0) - (Number(bv) || 0)) * sort.dir;
      });
  }, [sources, query, tier, health, sort]);

  const setSortKey = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' ? 1 : -1 }));

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="flex w-full items-center gap-2.5 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4 py-2.5 transition-colors focus-within:border-[var(--foreground)] lg:max-w-xs">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0 text-[var(--foreground-subtle)]">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="sr-only">Search sources</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search outlets or regions"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <FilterGroup
            label="Tier"
            value={tier}
            onChange={setTier}
            options={[{ value: 'all' as const, label: 'All tiers' }, ...tiers.map((t) => ({ value: t, label: TIER_NAMES[t] ?? `Tier ${t}` }))]}
          />
          <FilterGroup
            label="Health"
            value={health}
            onChange={setHealth}
            options={[
              { value: 'all' as const, label: 'Any health' },
              ...(['active', 'stale', 'failing', 'pending'] as const)
                .filter((h) => sources.some((s) => s.health === h))
                .map((h) => ({ value: h, label: HEALTH[h].label })),
            ]}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)]">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <caption className="sr-only">
            Sources: tier, articles ingested, stories broken first, corroboration rate and ingest health
          </caption>
          <thead className="bg-[var(--surface)]">
            <tr className="border-b border-[var(--border)]">
              <th scope="col" className="py-2.5 pl-4">
                <button type="button" onClick={() => setSortKey('name')} className="text-label text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]">
                  Outlet
                </button>
              </th>
              <SortHeader label="Articles" k="article_count" sort={sort} onSort={setSortKey} />
              <SortHeader label="Broke first" k="articles_broken_first" sort={sort} onSort={setSortKey} />
              <SortHeader label="Corroborated" k="corroboration_rate" sort={sort} onSort={setSortKey} />
              <th scope="col" className="text-label py-2.5 pl-6 pr-4 text-[var(--foreground-subtle)]">
                Ingest
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const h = HEALTH[s.health] ?? HEALTH.failing;
              return (
                <tr key={s.url} className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--surface)]">
                  <th scope="row" className="py-3 pl-4 pr-4 font-normal">
                    <span className="text-[14px] font-medium text-[var(--foreground)]">{s.name}</span>
                    <span className="font-data mt-0.5 block text-[11px] text-[var(--foreground-subtle)]">
                      {TIER_NAMES[s.tier] ?? `Tier ${s.tier}`} · {s.region_label}
                    </span>
                  </th>
                  <td className="font-data py-3 text-right text-[12px] tabular-nums text-[var(--foreground-muted)]">
                    {s.article_count.toLocaleString()}
                  </td>
                  <td className="font-data py-3 text-right text-[12px] tabular-nums text-[var(--foreground-muted)]">
                    {s.articles_broken_first > 0 ? s.articles_broken_first.toLocaleString() : '—'}
                  </td>
                  <td className="py-3 text-right">
                    {s.corroboration_rate > 0 ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="hidden h-[3px] w-14 overflow-hidden rounded-full bg-[var(--surface-sunken)] sm:inline-block" aria-hidden="true">
                          <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(s.corroboration_rate, 100)}%` }} />
                        </span>
                        <span className="font-data text-[12px] tabular-nums text-[var(--foreground-muted)]">
                          {s.corroboration_rate.toFixed(0)}%
                        </span>
                      </span>
                    ) : (
                      <span className="font-data text-[12px] text-[var(--foreground-subtle)]">—</span>
                    )}
                  </td>
                  <td className="py-3 pl-6 pr-4">
                    <span className="inline-flex items-center gap-1.5" title={h.title}>
                      <span className={`h-1.5 w-1.5 rounded-full ${h.dot}`} aria-hidden="true" />
                      <span className="font-data text-[11px] text-[var(--foreground-muted)]">{h.label}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[14px] text-[var(--foreground-muted)]">
                  No outlet matches. Try a different search or filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="font-data mt-3 text-[11px] text-[var(--foreground-subtle)]" aria-live="polite">
        Showing {rows.length} of {sources.length} feeds
      </p>
    </div>
  );
}

function FilterGroup<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="group" aria-label={label} className="pb-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface)] p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] px-3 py-1.5 text-[12px] transition-all duration-200 ${
            o.value === value
              ? 'bg-[var(--inverse)] text-[var(--inverse-foreground)]'
              : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SortHeader({
  label,
  k,
  sort,
  onSort,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
}) {
  const active = sort.key === k;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
      className="py-2.5 text-right"
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`text-label inline-flex items-center gap-1 transition-colors ${
          active ? 'text-[var(--foreground)]' : 'text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]'
        }`}
      >
        {label}
        <ArrowDown size={12} className={`transition-transform ${active ? 'opacity-100' : 'opacity-0'} ${sort.dir === 1 ? 'rotate-180' : ''}`} />
      </button>
    </th>
  );
}
