"use client";

import { useEffect, useState } from 'react';

import { AskSparkle } from '@/components/AskTrigger';
import { useAsk } from '@/components/AskProvider';
import CorroborationMeter from '@/components/CorroborationMeter';
import ListenButton from './ListenButton';
import { describeCorroboration } from '@/lib/corroboration';
import { coverageSpread } from '@/lib/spread';
import { relativeTime } from '@/lib/time';

/**
 * The story page's right rail: the evidence at a glance, the page's shape,
 * and its actions — sticky, so all three are one glance away however far down
 * the ledger a reader has gone.
 *
 * At a glance    the four numbers that decide how much weight the story can
 *                bear: independent newsrooms, total articles, who broke it,
 *                and how long the pickup took. The last is the one a counter
 *                alone hides — six outlets in twenty minutes is consistent
 *                with one wire feeding everyone.
 * On this page   a table of contents with scroll-spy. The story page runs to
 *                seven sections; without one, "where do they disagree?" means
 *                scrolling and skimming.
 */

export interface RailSection {
  id: string;
  label: string;
}

interface StoryRailProps {
  slug: string;
  title: string;
  independentCount: number;
  articleCount: number;
  firstSeenAt: string;
  lastUpdatedAt: string;
  brokenBy?: string | null;
  sections: RailSection[];
  listenText: string;
}

export default function StoryRail({
  slug,
  title,
  independentCount,
  articleCount,
  firstSeenAt,
  lastUpdatedAt,
  brokenBy,
  sections,
  listenText,
}: StoryRailProps) {
  const { open } = useAsk();
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);
  const [copied, setCopied] = useState(false);

  // Scroll-spy: the section crossing the upper-middle band of the viewport is
  // the one being read. A band rather than a line, so short sections still
  // register as the reader passes through them.
  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: '-20% 0px -65% 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  const descriptor = describeCorroboration(independentCount);
  const spread = coverageSpread(firstSeenAt, lastUpdatedAt, independentCount);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Dismissed — fall through to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable; nothing useful to say.
    }
  };

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------ at a glance */}
      <section
        aria-labelledby="glance-heading"
        className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5"
      >
        <h2 id="glance-heading" className="eyebrow">
          At a glance
        </h2>
        <div className="mt-4 flex items-end gap-3">
          <span
            className="font-display text-[64px] leading-[0.8] tabular-nums"
            style={{ color: `var(${descriptor.colorVar})` }}
          >
            {independentCount}
          </span>
          <div className="pb-1">
            <p className="text-[13px] font-medium text-[var(--foreground)]">
              independent {independentCount === 1 ? 'newsroom' : 'newsrooms'}
            </p>
            <CorroborationMeter outlets={independentCount} size="sm" showLabel={false} className="mt-1" />
          </div>
        </div>
        <p className="mt-3 text-[13px] leading-snug text-[var(--foreground-muted)]">
          {descriptor.description(independentCount)}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--border)] pt-4">
          <Fact label="Articles" value={articleCount.toLocaleString()} />
          <Fact label="Pickup span" value={spread.hours > 0 ? spread.label : '—'} />
          <Fact label="Broke it" value={brokenBy ?? '—'} wide />
          <Fact label="First seen" value={relativeTime(new Date(firstSeenAt))} />
          <Fact label="Updated" value={relativeTime(new Date(lastUpdatedAt))} />
        </dl>

        {spread.note && (
          <p
            className={`mt-4 rounded-[var(--radius-chip)] px-3 py-2 text-[12px] leading-snug ${
              spread.note === 'tight'
                ? 'bg-[var(--accent-secondary)]/10 text-[var(--foreground-muted)]'
                : 'bg-[var(--accent)]/8 text-[var(--foreground-muted)]'
            }`}
          >
            {spread.note === 'tight'
              ? 'Coverage arrived in a tight window — consistent with outlets running one wire report rather than reporting separately.'
              : 'Coverage accumulated over a long span — more consistent with newsrooms working separately.'}
          </p>
        )}
      </section>

      {/* ------------------------------------------------ actions */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => open({ story: { slug, title } })}
          className="pill pill-solid group w-full justify-center"
        >
          <AskSparkle className="transition-transform duration-500 group-hover:rotate-[18deg]" />
          Ask about this story
        </button>
        <div className="flex gap-2">
          <ListenButton text={listenText} label="Listen to brief" className="flex-1 [&>button]:w-full [&>button]:justify-center" />
          <button type="button" onClick={share} className="pill pill-outline !py-2 text-[13px]">
            {copied ? 'Copied' : 'Share'}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------ contents */}
      {sections.length > 1 && (
        <nav aria-labelledby="toc-heading" className="rounded-[var(--radius-card)] border border-[var(--border)] p-5">
          <h2 id="toc-heading" className="eyebrow mb-3">
            On this page
          </h2>
          <ol className="relative space-y-0.5 border-l border-[var(--border)]">
            {sections.map((s) => {
              const isActive = s.id === active;
              return (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    aria-current={isActive ? 'location' : undefined}
                    className={`-ml-px block border-l-2 py-1.5 pl-3.5 text-[13px] transition-all duration-300 ${
                      isActive
                        ? 'border-[var(--foreground)] font-medium text-[var(--foreground)]'
                        : 'border-transparent text-[var(--foreground-muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {s.label}
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
      )}
    </div>
  );
}

function Fact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-[11px] text-[var(--foreground-subtle)]">{label}</dt>
      <dd className="font-data mt-0.5 truncate text-[13px] text-[var(--foreground)]" suppressHydrationWarning>
        {value}
      </dd>
    </div>
  );
}
