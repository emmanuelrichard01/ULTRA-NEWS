import type { Metadata } from 'next';
import Link from 'next/link';

import CorroborationMeter from '@/components/CorroborationMeter';

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

function Section({
  id,
  title,
  children,
}: {
  id: SectionId;
  title: string;
  children: React.ReactNode;
}) {
  const index = SECTIONS.findIndex((s) => s.id === id) + 1;

  return (
    // `scroll-mt` clears the sticky header: without it, jumping to a section
    // from the index lands with its heading hidden behind the navbar.
    <section id={id} className="scroll-mt-20 border-t border-[var(--border)] py-9">
      <h2 className="text-display-md font-display mb-4 flex gap-3 text-[var(--foreground)]">
        <span
          className="font-data pt-[6px] text-[12px] tabular-nums text-[var(--foreground-subtle)]"
          aria-hidden="true"
        >
          {String(index).padStart(2, '0')}
        </span>
        {title}
      </h2>
      <div className="text-body-md measure space-y-4 text-[var(--foreground-muted)]">
        {children}
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="border-b-2 border-[var(--foreground)] pb-7">
        <h1 className="text-display-2xl font-display text-[var(--foreground)]">
          How this works
        </h1>
        <p className="text-body-lg measure mt-3 text-[var(--foreground-muted)]">
          Ultra News groups coverage of the same event from different newsrooms
          and tells you how many independent outlets stand behind it. That number
          is the whole product, so it&rsquo;s worth explaining exactly what it
          measures.
        </p>
      </header>

      {/*
        A contents index.

        This page is six sections of continuous prose and had no wayfinding at
        all: a reader who arrived wanting one specific answer — usually "what
        does this number NOT mean" — had to scroll and skim to find it. The
        index costs eight lines and makes the page's shape visible before the
        reading starts.
      */}
      <nav aria-labelledby="contents-heading" className="border-b border-[var(--border)] py-6">
        <h2 id="contents-heading" className="text-label mb-3 text-[var(--foreground-subtle)]">
          Contents
        </h2>
        <ol className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {SECTIONS.map((section, i) => (
            <li key={section.id} className="flex gap-3">
              <span
                className="font-data text-[12px] tabular-nums text-[var(--foreground-subtle)]"
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <a
                href={`#${section.id}`}
                className="text-body-sm text-[var(--foreground-muted)] underline decoration-[var(--border)] underline-offset-4 transition-colors hover:text-[var(--foreground)] hover:decoration-[var(--border-hover)]"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

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
          className="text-body-sm mt-2 inline-flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] px-4 py-2.5 text-[var(--foreground)] transition-colors hover:border-[var(--border-hover)]"
        >
          View the source
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </a>
      </Section>
    </div>
  );
}
