import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import CorroborationMeter from '@/components/CorroborationMeter';
import CategoryPill from '@/components/CategoryPill';
import SourceChip from '@/components/SourceChip';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';

interface StoryArticle {
  id: number;
  title: string;
  slug: string;
  url: string;
  excerpt: string;
  image_url?: string;
  published_date: string;
  source: { name: string };
}

interface StoryDetail {
  id: number;
  title: string;
  slug: string;
  summary: string;
  first_seen_at: string;
  last_updated_at: string;
  source_count: number;
  status: string;
  categories: string[];
  articles: StoryArticle[];
}

async function getStory(storyId: string): Promise<StoryDetail | null> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  try {
    const res = await fetch(`${API_URL}/api/v1/stories/${storyId}`, { 
      next: { tags: [`story:${storyId}`, 'story'] } 
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

interface StoryPageProps {
  params: Promise<{ storyId: string }>;
}

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const { storyId } = await params;
  const story = await getStory(storyId);
  if (!story) return { title: 'Story Not Found — Ultra News' };

  return {
    title: story.title,
    description: story.summary || `${story.source_count} sources covering this story.`,
    openGraph: {
      title: story.title,
      description: story.summary,
      type: 'article',
      publishedTime: story.first_seen_at,
      modifiedTime: story.last_updated_at,
    },
    other: {
      // schema.org structured data for Google News (V3 spec §13.5)
      'article:section': story.categories[0] || 'News',
    },
  };
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { storyId } = await params;
  const story = await getStory(storyId);
  if (!story) notFound();

  const primaryArticle = story.articles[0];
  const firstSeenDate = new Date(story.first_seen_at);

  return (
    <div className="max-w-4xl mx-auto">
      {/* schema.org NewsArticle structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: story.title,
            datePublished: story.first_seen_at,
            dateModified: story.last_updated_at,
            description: story.summary,
            publisher: {
              '@type': 'Organization',
              name: 'Ultra News',
              url: process.env.NEXT_PUBLIC_APP_URL || 'https://ultra-news.demo',
            },
          }),
        }}
      />

      {/* Back nav */}
      <nav className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-data text-[11px] font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          Back to Wire
        </Link>
      </nav>

      {/* Story Header */}
      <header className="mb-10 border-b-2 border-[var(--foreground)] pb-8">
        {/* Categories */}
        <div className="flex items-center gap-2 mb-4">
          {story.categories.map((cat) => (
            <CategoryPill key={cat} label={cat} href={`/${cat}`} />
          ))}
        </div>

        {/* Headline — Fraunces display */}
        <h1 className="text-display-xl font-display text-[var(--foreground)] mb-6 leading-[0.95]">
          {story.title}
        </h1>

        {/* AI Summary */}
        {story.summary && (
          <div className="mb-6">
            <p className="text-body-lg text-[var(--foreground-muted)] font-serif leading-relaxed">
              {story.summary}
            </p>
            <span className="font-data text-[10px] text-[var(--foreground-muted)] uppercase tracking-wider mt-2 inline-block opacity-60">
              AI Summary — Not editorial content
            </span>
          </div>
        )}

        {/* Corroboration Meter — full size */}
        <div className="flex flex-wrap items-center gap-4 p-4 bg-[var(--surface-elevated)] rounded-[var(--radius-card)] border border-[var(--border)]">
          <CorroborationMeter sourceCount={story.source_count} size="lg" showLabel />
          <div className="h-6 w-px bg-[var(--border)]" />
          <div className="flex flex-col gap-0.5">
            <span className="font-data text-[11px] text-[var(--foreground-muted)]">
              First reported {formatDistanceToNow(firstSeenDate, { addSuffix: true })}
            </span>
            <span className="font-data text-[10px] text-[var(--foreground-muted)] opacity-60">
              {firstSeenDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {' · '}
              {firstSeenDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
            </span>
          </div>
        </div>
      </header>

      {/* Hero Image from primary article */}
      {primaryArticle?.image_url && (
        <div className="relative aspect-[21/9] w-full overflow-hidden rounded-[var(--radius-card)] mb-10 bg-[var(--surface-elevated)]">
          <img
            src={primaryArticle.image_url}
            alt={story.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      )}

      {/* Side-by-Side Headline Framing Comparison */}
      {story.source_count > 1 && (
        <section className="mb-12">
          <h2 className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-4 border-b border-[var(--border)] pb-2">
            Side-by-Side Headline Framing
          </h2>
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 pb-scrollbar">
            {[...story.articles]
              .sort((a, b) => new Date(a.published_date).getTime() - new Date(b.published_date).getTime())
              .map((article) => (
              <div 
                key={`frame-${article.slug}`} 
                className="snap-start flex-none w-72 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-card)] p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="mb-3">
                    <SourceChip name={article.source.name} />
                  </div>
                  <h3 className="font-display text-[15px] font-bold text-[var(--foreground)] leading-snug mb-3">
                    "{article.title}"
                  </h3>
                  {article.excerpt && (
                    <p className="font-serif text-[13px] text-[var(--foreground-muted)] line-clamp-4 leading-relaxed">
                      {article.excerpt}
                    </p>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="font-data text-[10px] text-[var(--accent)] font-semibold hover:underline">
                    Read original source →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Story Timeline — chronological evolution */}
      <section className="mb-12">
        <h2 className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-6 border-b border-[var(--border)] pb-2 flex justify-between items-end">
          <span>Story Timeline ({story.source_count} {story.source_count === 1 ? 'source' : 'sources'})</span>
          <span className="font-normal opacity-60">Earliest report first ↓</span>
        </h2>

        <div className="relative border-l-2 border-[var(--border)] ml-2 pl-6 space-y-8">
          {(() => {
            const sortedArticles = [...story.articles].sort((a, b) => new Date(a.published_date).getTime() - new Date(b.published_date).getTime());
            const firstDate = sortedArticles.length > 0 ? new Date(sortedArticles[0].published_date) : new Date();

            return sortedArticles.map((article, i) => {
              const articleDate = new Date(article.published_date);
              const isFirst = i === 0;
              const minutesDelta = differenceInMinutes(articleDate, firstDate);
              const hours = Math.floor(minutesDelta / 60);
              const mins = minutesDelta % 60;
              let deltaStr = '';
              if (hours > 0) deltaStr += `${hours}h `;
              deltaStr += `${mins}m`;

              return (
              <div
                key={article.slug}
                className="relative flex flex-col sm:flex-row sm:items-start gap-4 group"
              >
                {/* Timeline node */}
                <div className={`absolute -left-[31px] top-2 w-3 h-3 rounded-full border-2 border-[var(--surface)] ${isFirst ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />

                {/* Source + timestamp */}
                <div className="flex-shrink-0 sm:w-40 pt-0.5">
                  <SourceChip name={article.source.name} />
                  <span className="block font-data text-[10px] text-[var(--foreground-muted)] mt-1.5">
                    {formatDistanceToNow(articleDate, { addSuffix: true })}
                  </span>
                  {isFirst ? (
                    <span className="inline-block mt-2 font-data text-[9px] uppercase tracking-wider text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded-sm">
                      First to report
                    </span>
                  ) : (
                    <span className="inline-block mt-2 font-data text-[9px] uppercase tracking-wider text-[var(--foreground-muted)] bg-[var(--surface-elevated)] border border-[var(--border)] px-1.5 py-0.5 rounded-sm">
                      +{deltaStr} later
                    </span>
                  )}
                </div>

                {/* Article angle / framing explicitly shown */}
                <div className="flex-1 min-w-0 bg-[var(--surface-elevated)] p-4 rounded-[var(--radius-card)] border border-[var(--border)] transition-colors group-hover:border-[var(--foreground-muted)]">
                  <h3 className="text-[16px] font-display font-semibold text-[var(--foreground)] leading-snug mb-2">
                    "{article.title}"
                  </h3>
                  {article.excerpt && (
                    <p className="text-body-sm text-[var(--foreground-muted)] line-clamp-3">
                      {article.excerpt}
                    </p>
                  )}
                  
                  {/* Outbound link */}
                  <div className="mt-4 pt-3 border-t border-[var(--border)]">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-data text-[10px] font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity"
                    >
                      Read full framing at {article.source.name}
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" x2="21" y1="14" y2="3" /></svg>
                    </a>
                  </div>
                </div>
              </div>
            );
          });
          })()}
        </div>
      </section>

      {/* Related Stories placeholder — Phase 3 (pgvector similarity) */}
      <section className="py-8 border-t border-[var(--border)]">
        <h2 className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
          Related Stories
        </h2>
        <p className="text-body-md text-[var(--foreground-muted)] italic">
          Semantic similarity matching coming in Phase 3.
        </p>
      </section>
    </div>
  );
}
