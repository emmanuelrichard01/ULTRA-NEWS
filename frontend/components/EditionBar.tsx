import Link from 'next/link';

import AskTrigger from './AskTrigger';
import { EDITIONS, editionHref, type Edition } from '@/lib/editions';

/**
 * EditionBar — the feed's masthead, in one row.
 *
 * What this replaces: an edition rule, a display heading rendering the same
 * edition name again at clamp(2.75rem, 5vw+1rem, 4.5rem), a two-line tagline, a
 * 2px rule, and a right-aligned 11px rubric — five elements to say two things.
 * Measured on a 1366x900 laptop, the first headline on The Wire began around
 * y=780: the entire first screen was chrome, and none of it was news.
 *
 * The heading was the worst of it. It set the page's own name in the largest
 * type in the product, directly under a nav that had just said the same word,
 * and the tagline beneath was onboarding copy shown permanently to readers who
 * had long since been onboarded. Linear, Stripe and Notion all decline to
 * render a page's title inside the page for exactly this reason.
 *
 * So the edition tabs ARE the title. The active one carries display type and a
 * heavy underline — a broadsheet marking its current section — and the
 * document's <h1> is present for screen readers and search engines without
 * spending a third of the viewport to repeat what the tab already says.
 *
 * Below it sits one sentence: what this ordering does, and what the current
 * filter is doing to it. That sentence used to be two fragments at opposite
 * ends of a control row, the more important of the two set in the smallest,
 * faintest, most letterspaced type on the page.
 */

interface EditionBarProps {
  current: Edition;
  /** Page title for topic routes, which borrow The Wire's ordering. */
  titleOverride?: string;
  /** The one orienting sentence: ordering, then what the filter is doing. */
  orientation: string;
  /** Live state of the feed, shown on the same line as the sentence. */
  status?: React.ReactNode;
  onAsk: () => void;
}

export default function EditionBar({
  current,
  titleOverride,
  orientation,
  status,
  onAsk,
}: EditionBarProps) {
  return (
    <div className="mb-6">
      <h1 className="sr-only">{titleOverride ?? current.name} — Ultra News</h1>

      <div className="flex items-end justify-between gap-4 border-b border-[var(--border)]">
        {/*
          The nameplate.

          The old masthead set the edition's name at up to 72px on its own line,
          then repeated it as a tab, then explained it in a two-line tagline —
          three elements and roughly a third of the viewport to say one word.
          Cutting it to a row of same-sized tabs fixed the space and lost the
          editorial voice with it; a broadsheet's section head is not the same
          size as its cross-references.

          So the three editions share one baseline and the ACTIVE one carries
          the display weight while the others sit small beside it. It reads as a
          nameplate with its alternatives visible, occupies one row, and the
          size difference does the work the old heading did.

          Hovering an inactive edition lifts it partway toward the active size —
          a preview of the switch, on the same principle as the framing chips:
          the interface shows you what will happen before you commit.
        */}
        <nav aria-label="Editions" className="-mb-px min-w-0">
          <ul className="pb-scrollbar flex items-baseline gap-4 overflow-x-auto sm:gap-6">
            {EDITIONS.map((edition) => {
              const isActive = !titleOverride && edition.slug === current.slug;
              return (
                <li key={edition.slug || 'wire'}>
                  <Link
                    href={editionHref(edition)}
                    aria-current={isActive ? 'page' : undefined}
                    title={edition.rubric}
                    className={`block origin-bottom whitespace-nowrap border-b-2 pb-3 font-display tracking-tight transition-all duration-300 ease-[var(--ease-out)] ${
                      isActive
                        ? 'animate-fade-in-up border-[var(--foreground)] text-[28px] text-[var(--foreground)] sm:text-[34px]'
                        : 'border-transparent text-[15px] text-[var(--foreground-subtle)] hover:text-[var(--foreground)] sm:text-[17px] sm:hover:text-[19px]'
                    }`}
                  >
                    {edition.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/*
          Ask sits on the masthead rule rather than floating beside the old
          heading, because it is the page's one non-navigational action and
          belongs where the reader's eye already is.
        */}
        <AskTrigger onClick={onAsk} className="mb-2.5" />
      </div>

      {/* Titles for topic routes, which are not editions and so cannot be a tab. */}
      {titleOverride && (
        <p className="text-display-md mt-4 font-display text-[var(--foreground)]">
          {titleOverride}
        </p>
      )}

      {/* Orientation and live state share one band. As separate full-width
          rows they were the fourth and fifth stacked elements of a header the
          reader had to get past before reaching a headline. */}
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p
          className="text-body-sm measure text-[var(--foreground-muted)]"
          aria-live="polite"
        >
          {orientation}
        </p>
        {status}
      </div>
    </div>
  );
}
