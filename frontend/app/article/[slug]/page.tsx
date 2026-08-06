import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import CorroborationMeter from '@/components/CorroborationMeter';
import CategoryPill from '@/components/CategoryPill';
import NewsImage from '@/components/NewsImage';
import { fetchArticle } from '@/lib/api';

/**
 * Article page — a single report, pointed at its story.
 *
 * Ultra News shows excerpts and links out; it does not republish publisher copy.
 * So this page has two honest jobs: attribute the report to the newsroom that
 * wrote it and send the reader there, and surface the story cluster it belongs
 * to — which is where the product's actual value is, since one report on its own
 * is exactly the thing corroboration is meant to qualify.
 *
 * The page previously carried its own copy of the API client (pointing at
 * NEXT_PUBLIC_API_URL with `cache: 'no-store'`), so it missed every fix applied
 * to the shared one.
 */

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticle(slug);
  if (!article) return { title: 'Article not found' };

  return {
    title: article.title,
    description: article.excerpt || `Coverage from ${article.source.name}.`,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: 'article',
      publishedTime: article.published_date,
      images: article.image_url ? [{ url: article.image_url, width: 1200, height: 630 }] : [],
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await fetchArticle(slug);
  if (!article) notFound();

  const published = new Date(article.published_date);
  const outlets = article.story_source_count ?? 1;

  return (
    <article className="mx-auto max-w-3xl">
      <nav className="mb-8">
        <Link
          href="/"
          className="text-body-sm inline-flex items-center gap-1.5 text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to the wire
        </Link>
      </nav>

      <header className="border-b-2 border-[var(--foreground)] pb-7">
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-data text-[13px] font-semibold text-[var(--foreground)]">
            {article.source.name}
          </span>
          <time
            dateTime={published.toISOString()}
            className="font-data text-[12px] text-[var(--foreground-subtle)]"
          >
            {published.toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </time>
          {article.categories?.map((cat) => (
            <CategoryPill key={cat} label={cat} href={`/${cat}`} size="xs" />
          ))}
        </div>

        <h1 className="text-display-xl font-display text-balance text-[var(--foreground)]">
          {article.title}
        </h1>
      </header>

      {article.image_url && (
        <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface-sunken)]">
          <NewsImage
            src={article.image_url}
            alt=""
            priority
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      )}

      {article.excerpt && (
        <p className="text-body-lg measure mt-8 text-[var(--foreground)]">{article.excerpt}</p>
      )}

      {/* Read the original. This is the primary action — we don't host the copy. */}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-flex items-center gap-2 rounded-[var(--radius-card)] bg-[var(--foreground)] px-5 py-3 text-body-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90"
      >
        Read the full article at {article.source.name}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      </a>

      {/* The story cluster — where a single report gets its context. */}
      {article.story_slug ? (
        <section className="mt-12 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-label mb-3 text-[var(--foreground-subtle)]">
            This report is part of a story
          </h2>
          <div className="mb-4">
            <CorroborationMeter outlets={outlets} size="md" />
          </div>
          <p className="text-body-md mb-4 text-[var(--foreground-muted)]">
            {outlets >= 3
              ? `${outlets} independent outlets have corroborated this event. See who broke it, how quickly others followed, and where their accounts differ.`
              : outlets === 2
              ? 'A second independent outlet has reported this event. See how the accounts compare.'
              : 'No other outlet has independently confirmed this yet.'}
          </p>
          <Link
            href={`/story/${article.story_slug}`}
            className="text-label inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] border border-[var(--border)] px-3 py-2 text-[var(--foreground)] transition-colors hover:border-[var(--border-hover)]"
          >
            View the full story
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </section>
      ) : (
        <p className="text-body-sm mt-12 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--foreground-muted)]">
          This report hasn&rsquo;t been matched to a story cluster yet. Clustering
          runs every few minutes.
        </p>
      )}
    </article>
  );
}
