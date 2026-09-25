import AskTrigger from './AskTrigger';
import type { Edition } from '@/lib/editions';

/**
 * The header of a feed.
 *
 * It used to be the edition switcher as well — a row of three tabs with the
 * active one set large. The editions now lead the sticky section bar on every
 * page, so repeating them here would name the current section twice, one
 * above the other. What is left is what a page header is for: say where you
 * are, in the serif, large; say how this list is ordered; show that it is live.
 *
 * `heading` lets The Wire's front page title its feed "Latest on the wire"
 * beneath the lead block, where the edition name alone would read as a second
 * masthead halfway down the page.
 */

interface EditionBarProps {
  current: Edition;
  titleOverride?: string;
  heading?: string;
  orientation: string;
  status?: React.ReactNode;
  onAsk: () => void;
  /** Set as an <h2> under a page that already has its own lead. */
  asSection?: boolean;
}

export default function EditionBar({
  current,
  titleOverride,
  heading,
  orientation,
  status,
  onAsk,
  asSection = false,
}: EditionBarProps) {
  const title = heading ?? titleOverride ?? current.name;
  const Heading = asSection ? 'h2' : 'h1';

  return (
    <header className={`mb-8 ${asSection ? 'border-t border-[var(--border)] pt-12' : ''}`}>
      <div className="flex flex-col gap-6 border-b border-[var(--border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="eyebrow mb-3">
            {titleOverride ? 'Topic' : current.name}
            <span className="text-[var(--foreground-subtle)]">· {current.rubric}</span>
          </p>
          <Heading
            className={`font-display text-balance text-[var(--foreground)] ${
              asSection ? 'text-display-xl' : 'text-display-2xl animate-fade-in-up'
            }`}
          >
            {title}
          </Heading>
          <p className="text-body-md measure mt-3 text-[var(--foreground-muted)]" aria-live="polite">
            {orientation}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-3 lg:items-end">
          <AskTrigger onClick={onAsk} />
          {status}
        </div>
      </div>
    </header>
  );
}
