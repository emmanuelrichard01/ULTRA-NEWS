import { formatDistanceToNow } from 'date-fns';

import type { StoryArticle } from '@/lib/types';

/**
 * SourceLedger — every article behind the story, grouped by outlet.
 *
 * Ultra News shows excerpts and links out; it does not host publisher copy. So
 * the ledger is the page's accountability record: every claim above traces to
 * something here, and each row goes to the newsroom that wrote it.
 *
 * Grouping by outlet rather than listing articles flat keeps a newsroom filing
 * five updates from looking like five separate corroborations.
 */
export default function SourceLedger({ articles }: { articles: StoryArticle[] }) {
  if (articles.length === 0) return null;

  const byOutlet = new Map<string, StoryArticle[]>();
  [...articles]
    .sort((a, b) => new Date(a.published_date).getTime() - new Date(b.published_date).getTime())
    .forEach((article) => {
      const list = byOutlet.get(article.source.name) ?? [];
      list.push(article);
      byOutlet.set(article.source.name, list);
    });

  return (
    <section aria-labelledby="ledger-heading" className="border-t border-[var(--border)] py-12">
      <h2 id="ledger-heading" className="text-display-md font-display text-[var(--foreground)]">
        Every source
      </h2>
      <p className="text-body-sm measure mb-8 mt-1.5 text-[var(--foreground-muted)]">
        {articles.length} {articles.length === 1 ? 'article' : 'articles'} from{' '}
        {byOutlet.size} {byOutlet.size === 1 ? 'outlet' : 'outlets'}. Links go to
        the original reporting.
      </p>

      <div className="space-y-6">
        {[...byOutlet.entries()].map(([outlet, outletArticles]) => (
          <div key={outlet}>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="font-data text-[13px] font-semibold text-[var(--foreground)]">
                {outlet}
              </h3>
              {outletArticles.length > 1 && (
                <span className="font-data text-[11px] text-[var(--foreground-subtle)]">
                  {outletArticles.length} updates
                </span>
              )}
            </div>

            <ul className="space-y-2 border-l border-[var(--border)] pl-4">
              {outletArticles.map((article) => (
                <li key={article.url}>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-baseline gap-2"
                  >
                    <span className="text-body-sm text-[var(--foreground-muted)] transition-colors group-hover:text-[var(--accent)]">
                      {article.title}
                    </span>
                    <svg
                      width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      className="shrink-0 translate-y-[1px] text-[var(--foreground-subtle)]"
                      aria-hidden="true"
                    >
                      <path d="M7 17 17 7M9 7h8v8" />
                    </svg>
                  </a>
                  <time
                    dateTime={new Date(article.published_date).toISOString()}
                    className="font-data text-[11px] text-[var(--foreground-subtle)]"
                  >
                    {formatDistanceToNow(new Date(article.published_date), { addSuffix: true })}
                  </time>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
