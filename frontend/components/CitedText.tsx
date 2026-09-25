import { Fragment } from 'react';

/**
 * Server-rendered text with `[n]` citations and **bold**.
 *
 * The Ask dialog has an interactive equivalent (hover sync, client state);
 * this one is for static pages — the Briefing — where a citation is simply a
 * link to an anchor. Like the dialog, it renders only these two constructs, so
 * no markup in model output can reach the DOM, and a number with no target is
 * dropped rather than shown as a dead link.
 */
export default function CitedText({
  text,
  hrefFor,
  titleFor,
}: {
  text: string;
  hrefFor: (n: number) => string | null;
  titleFor?: (n: number) => string | undefined;
}) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|\[\d+(?:\s*,\s*\d+)*\])/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        const cite = part.match(/^\[(\d+(?:\s*,\s*\d+)*)\]$/);
        if (cite) {
          return (
            <Fragment key={i}>
              {cite[1].split(',').map((raw) => {
                const n = Number(raw.trim());
                const href = hrefFor(n);
                if (!href) return null;
                return (
                  <a key={n} href={href} className="cite-chip" title={titleFor?.(n)} aria-label={`Story ${n}`}>
                    {n}
                  </a>
                );
              })}
            </Fragment>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
