import type { Metadata } from 'next';
import Link from 'next/link';

import CorroborationMeter from '@/components/CorroborationMeter';
import { ArrowRight } from '@/components/icons';

/**
 * About — the method, stated plainly, including its limits.
 *
 * A product whose claim is "we tell you how well-supported a story is" has to be
 * legible about how it decides that, and candid about where it gets things
 * wrong. The previous version was marketing copy about an "AI-powered
 * intelligence engine"; anyone can write that, and it gives a reader no way to
 * judge whether the corroboration count in front of them means anything.
 */

export const metadata: Metadata = {
  title: 'About',
  description:
    'How Ultra News clusters coverage, what a corroboration count does and does not mean, and where the method falls short.',
};

/**
 * The page's own contents, in order.
 *
 * Declared once and used for both the index and the section headings, so a
 * section cannot appear in one and not the other — the usual failure mode of a
 * hand-maintained table of contents.
 */
const SECTIONS = [
  { id: 'the-number', title: 'What the number means' },
  { id: 'limits', title: 'What it does not mean' },
  { id: 'clustering', title: 'How stories are grouped' },
  { id: 'briefs', title: 'The AI briefs' },
  { id: 'shortcomings', title: 'Where it falls short' },
  { id: 'open-source', title: 'Open source' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

const PIPELINE = [
  {
    title: 'Ingest',
    cadence: 'every 15 min',
    body: 'Feeds are polled with conditional requests; only new articles are fetched in full.',
    ai: false,
  },
  {
    title: 'Cluster',
    cadence: 'every 3 min',
    body: 'Each article is embedded locally and joined to a story only above a measured similarity threshold.',
    ai: false,
  },
  {
    title: 'Count',
    cadence: 'on every join',
    body: 'Distinct publishers are recounted from the database. Feeds from one newsroom count once.',
    ai: false,
  },
  {
    title: 'Brief',
    cadence: 'when outlets join',
    body: 'A model summarises agreement, flags contradictions, and must cite only outlets in the story.',
    ai: true,
  },
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: SectionId;
  title: string;
  children: React.ReactNode;
}) {

  return (
    // `scroll-mt` clears the sticky header: without it, jumping to a section
    // from the index lands with its heading hidden behind the navbar.
    <section id={id} className="scroll-mt-[calc(var(--header-h)+2rem)] border-t border-[var(--border)] py-12">
      <h2 className="text-display-lg font-display mb-5 text-[var(--foreground)]">{title}</h2>
      <div className="text-body-lg measure space-y-4 text-[var(--foreground-muted)]">
        {children}
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="border-b border-[var(--border)] pb-12">
        <h1 className="text-display-3xl font-display animate-fade-in-up max-w-4xl text-balance text-[var(--foreground)]">
          One number, <span className="italic text-[var(--foreground-muted)]">explained honestly.</span>
        </h1>
        <p className="text-body-lg measure mt-6 text-[var(--foreground-muted)]">
          Ultra News groups coverage of the same event from different newsrooms
          and tells you how many independent outlets stand behind it. That
          number is the whole product, so it&rsquo;s worth explaining exactly
          what it measures — and what it cannot.
        </p>
      </header>

      {/*
        The pipeline, drawn. Four stages a reader can hold in their head before
        reading six sections of prose about them — and the fourth is marked as
        the only one a language model touches, because readers assume the
        opposite.
      */}
      <section aria-labelledby="pipeline-heading" className="border-b border-[var(--border)] py-12">
        <h2 id="pipeline-heading" className="eyebrow mb-6">How a story is made</h2>
        <ol className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map((step, i) => (
            <li
              key={step.title}
              className={`relative flex flex-col rounded-[var(--radius-card)] border p-5 ${
                step.ai
                  ? 'ai-border bg-[var(--surface-elevated)]'
                  : 'border-[var(--border)] bg-[var(--surface-elevated)]'
              }`}
            >
              <span className="font-data text-[11px] text-[var(--foreground-subtle)]">
                {String(i + 1).padStart(2, '0')} · {step.cadence}
              </span>
              <span className="font-display mt-3 text-[30px] leading-none text-[var(--foreground)]">{step.title}</span>
              <span className="text-body-sm mt-3 text-[var(--foreground-muted)]">{step.body}</span>
              <span
                className={`font-data mt-auto pt-4 text-[11px] ${
                  step.ai ? 'text-[var(--accent)]' : 'text-[var(--foreground-subtle)]'
                }`}
              >
                {step.ai ? 'Language model · optional' : 'No language model'}
              </span>
              {i < PIPELINE.length - 1 && (
                <span aria-hidden="true" className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] text-[11px] text-[var(--foreground-subtle)] lg:flex">
                  <ArrowRight size={11} />
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
        {/*
          A contents index, sticky beside the prose. This page is six sections
          of continuous text; a reader who arrived wanting one answer —
          usually "what does this number NOT mean" — can go straight to it.
        */}
        <nav aria-labelledby="contents-heading" className="pt-12 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:self-start">
          <h2 id="contents-heading" className="eyebrow mb-4">
            Contents
          </h2>
          <ol className="space-y-1 border-l border-[var(--border)]">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="-ml-px flex gap-3 border-l-2 border-transparent py-1.5 pl-3.5 text-[13px] text-[var(--foreground-muted)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 max-w-3xl">
      <Section id="the-number" title="What the number means">
        <p>
          Every story carries a count of{' '}
          <strong className="text-[var(--foreground)]">independent publishers</strong> — not
          articles. If one newsroom files five updates, that is one outlet, not
          five. If two feeds come from the same publisher, they count once. A
          newsroom cannot corroborate itself.
        </p>
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
          {[
            { n: 1, text: 'One outlet. Nobody else has confirmed it yet.' },
            { n: 2, text: 'A second newsroom independently reported the same event.' },
            { n: 5, text: 'Widely corroborated across independent newsrooms.' },
          ].map((row) => (
            <div key={row.n} className="flex items-center gap-4">
              <CorroborationMeter outlets={row.n} size="sm" showLabel={false} />
              <span className="text-body-sm text-[var(--foreground-muted)]">{row.text}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="limits" title="What it does not mean">
        <p>
          A high count is not a truth score. Ten outlets can repeat the same
          mistaken wire report, and that is exactly what a corroboration count
          looks like when it fails. This is why every story shows a{' '}
          <strong className="text-[var(--foreground)]">pickup pattern</strong>: six outlets
          publishing within twenty minutes is consistent with one wire feeding
          everyone, while six over nine hours suggests newsrooms working
          separately. Both read as &ldquo;six outlets&rdquo; on the counter alone.
        </p>
        <p>
          A low count is not a red flag either. Original investigative reporting
          starts at one outlet by definition.
        </p>
      </Section>

      <Section id="clustering" title="How stories are grouped">
        <p>
          Headlines are converted into vectors by an embedding model running
          locally, and articles whose vectors are close enough are treated as
          covering the same event. The threshold is set by measurement rather
          than taste: it sits above every different-event pair in our labelled
          benchmark, which means the system prefers to leave two related stories
          separate rather than risk merging unrelated ones.
        </p>
        <p>
          That choice has a cost. Two reports of one event worded very
          differently — &ldquo;CBN holds rates&rdquo; and &ldquo;Apex Bank keeps
          policy unchanged&rdquo; — can fail to merge, and you will occasionally
          see the same event as two entries. We accept that, because inventing a
          corroboration that does not exist is the worse error for a product like
          this one.
        </p>
      </Section>

      <Section id="briefs" title="The AI briefs">
        <p>
          Where a story has several sources, a language model writes a short brief
          summarising what they collectively say and, more usefully, where they
          contradict each other. These are machine-written and not human-edited,
          which is stated on every brief. Treat them as a reading aid and check
          them against the sources listed underneath — all of which link out to
          the newsroom that did the work.
        </p>
        <p>
          Briefs are checked before they are shown: a fact or claim attributed
          to an outlet that is not actually covering the story is removed, and
          so is any comparison with official documents when none were in the
          reporting. The daily{' '}
          <Link href="/briefing" className="text-[var(--accent)] underline underline-offset-2">
            Briefing
          </Link>{' '}
          follows the same rules and includes only stories a second newsroom
          has confirmed.
        </p>
        <p>
          Ultra News does not republish anyone&rsquo;s article. Every story shows
          a short excerpt and sends you to the original.
        </p>
      </Section>

      <Section id="shortcomings" title="Where it falls short">
        <p>
          Topic classification is semantic rather than editorial, and misfiles
          things near category boundaries. Publisher independence is inferred
          from domains, so two outlets under common ownership may count
          separately. Coverage skews toward English-language feeds. Timestamps
          come from publishers and are sometimes wrong, which distorts who
          appears to have broken a story.
        </p>
        <p>
          The source registry, including which feeds are currently failing, is{' '}
          <Link href="/rss" className="text-[var(--accent)] underline underline-offset-2">
            published in full
          </Link>
          .
        </p>
      </Section>

      <Section id="open-source" title="Open source">
        <p>
          The whole system is open source — ingestion, clustering, the thresholds
          and the benchmarks used to set them. If you think a threshold is wrong,
          the measurement is there to argue with.
        </p>
        <a
          href="https://github.com/emmanuelrichard01/ULTRA-NEWS"
          target="_blank"
          rel="noopener noreferrer"
          className="pill pill-solid group mt-2"
        >
          View the source
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </a>
      </Section>
        </div>
      </div>
    </div>
  );
}
