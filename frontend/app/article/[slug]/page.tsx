import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import CorroborationMeter from '@/components/CorroborationMeter';
import SourceChip from '@/components/SourceChip';
import CategoryPill from '@/components/CategoryPill';
import { formatDistanceToNow } from 'date-fns';

interface ArticleDetail {
  id: number;
  title: string;
  slug: string;
  url: string;
  image_url?: string;
  excerpt: string;
  published_date: string;
  source: { name: string };
  story_slug?: string;
  story_source_count?: number;
  story_status?: string;
  categories: string[];
}

async function getArticle(slug: string): Promise<ArticleDetail | null> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  try {
    const res = await fetch(`${API_URL}/api/v1/articles/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: 'Article Not Found' };

  return {
    title: article.title,
    description: article.excerpt || `Read coverage from ${article.source.name}.`,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: 'article',
      publishedTime: article.published_date,
      images: article.image_url ? [{ url: article.image_url, width: 1200, height: 630 }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt,
      images: article.image_url ? [article.image_url] : [],
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const publishedDate = new Date(article.published_date);
  const sourceCount = article.story_source_count || 1;
  const storyStatus = article.story_status || 'developing';

  // Calculate real read time from excerpt word count (estimate full article ~5x excerpt)
  const wordCount = (article.excerpt || '').split(/\s+/).length * 5;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="max-w-3xl mx-auto">
      {/* schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: article.title,
            datePublished: article.published_date,
            description: article.excerpt,
            image: article.image_url || undefined,
            author: { '@type': 'Organization', name: article.source.name },
            publisher: { '@type': 'Organization', name: 'Ultra News' },
            mainEntityOfPage: article.url,
          }),
        }}
      />

      {/* Article Header - Briefing Format */}
      <header className="mb-8 border-b-2 border-[var(--foreground)] pb-6">
        <div className="flex items-center justify-between mb-6">
          {/* Dispatch Metadata */}
          <div className="flex items-center gap-3 font-data text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)]">
            <span className="text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-1 rounded-sm">
              Intelligence Brief
            </span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline">Dispatch {article.id.toString().padStart(6, '0')}</span>
          </div>

          <Link
            href="/"
            className="flex items-center gap-1.5 font-data text-[10px] font-bold uppercase tracking-widest text-[var(--foreground)] border border-[var(--border)] px-3 py-1.5 rounded-[var(--radius-chip)] hover:bg-[var(--surface-elevated)] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Close
          </Link>
        </div>

        {/* Categories + Source */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <SourceChip name={article.source.name} />
          <span className="text-[var(--border)]">·</span>
          {article.categories.map((cat) => (
            <CategoryPill key={cat} label={cat} href={`/${cat}`} />
          ))}
        </div>

        {/* Headline */}
        <h1 className="text-display-xl font-display text-[var(--foreground)] mb-4 leading-[0.95]">
          {article.title}
        </h1>

        {/* Metadata bar */}
        <div className="flex flex-wrap items-center gap-4 text-[var(--foreground-muted)]">
          <span className="font-data text-[11px]">
            {formatDistanceToNow(publishedDate, { addSuffix: true })}
          </span>
          <span className="w-1 h-1 bg-[var(--border)] rounded-full" />
          <span className="font-data text-[11px]">
            {readTime} min read
          </span>
          <span className="w-1 h-1 bg-[var(--border)] rounded-full" />
          <CorroborationMeter sourceCount={sourceCount} size="sm" />
        </div>
      </header>

      {/* Hero Image */}
      {article.image_url && (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-card)] mb-10 bg-[var(--surface-elevated)]">
          <img
            src={article.image_url}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-10">
        <div className="flex-1">
          {/* Excerpt — Monospace Data Feed Style */}
          <div className="mb-10 p-6 bg-[var(--surface-elevated)] border-l-2 border-[var(--border)] rounded-r-[var(--radius-card)]">
            <div className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
              [Raw Excerpt Intercepted]
            </div>
            <p className="text-body-lg text-[var(--foreground)] leading-relaxed font-serif">
              {article.excerpt}
            </p>
          </div>

          {/* Outbound CTA */}
          <div className="mb-10">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-[var(--foreground)] text-[var(--background)] rounded-[var(--radius-card)] hover:opacity-95 transition-opacity"
            >
              <div>
                <span className="block font-data text-[10px] font-bold uppercase tracking-widest text-[var(--background)]/70 mb-1">
                  Primary Source Material
                </span>
                <span className="block text-lg font-display font-semibold">
                  Read full dispatch at {article.source.name}
                </span>
              </div>
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--background)]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" x2="21" y1="14" y2="3" /></svg>
              </div>
            </a>
          </div>
        </div>

        {/* Sidebar / Cluster Context */}
        <aside className="w-full md:w-72 flex-shrink-0">
          <div className="sticky top-20 border border-[var(--border)] rounded-[var(--radius-card)] p-5 bg-[var(--surface)] shadow-sm">
            <div className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-4 border-b border-[var(--border)] pb-2">
              Cluster Intelligence
            </div>
            
            <p className="text-sm font-display text-[var(--foreground)] mb-4 leading-relaxed">
              You are reading a single perspective. Ultra News triangulates coverage from multiple outlets.
            </p>

            <div className="mb-6 bg-[var(--surface-elevated)] p-4 rounded-[var(--radius-chip)] border border-[var(--border)]">
              <div className="font-data text-[10px] uppercase text-[var(--foreground-muted)] mb-2">
                Corroboration
              </div>
              <CorroborationMeter sourceCount={sourceCount} size="md" />
            </div>

            {article.story_slug ? (
              <Link
                href={`/story/${article.story_slug}`}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[var(--surface-elevated)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--foreground)] font-data text-xs font-bold uppercase tracking-wider rounded-[var(--radius-chip)] transition-colors"
              >
                View Full Story Cluster
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </Link>
            ) : (
              <div className="text-center p-3 font-data text-[10px] text-[var(--foreground-muted)] bg-[var(--surface-elevated)] rounded-[var(--radius-chip)] border border-[var(--border)]">
                Isolated Report (Uncorroborated)
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
