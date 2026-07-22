import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import CorroborationMeter from '@/components/CorroborationMeter';
import CategoryPill from '@/components/CategoryPill';
import SourceChip from '@/components/SourceChip';
import ExportBriefButton from '@/components/ExportBriefButton';
import StickyStoryNav from '@/components/StickyStoryNav';
import { fetchStory, fetchRelatedStories } from '@/lib/api';
import type { StoryDetailFull, StoryDetail } from '@/lib/types';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';

interface StoryPageProps {
  params: Promise<{ storyId: string }>;
}

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const { storyId } = await params;
  const story = await fetchStory(storyId);
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
      'article:section': story.categories[0] || 'News',
    },
  };
}

/**
 * CoverageVelocityChart — Visual step-chart showing how fast sources accumulated
 * Pure HTML/CSS — no charting library needed
 */
function CoverageVelocityChart({ articles }: { articles: StoryDetailFull['articles'] }) {
  if (articles.length < 2) return null;

  const sorted = [...articles].sort(
    (a, b) => new Date(a.published_date).getTime() - new Date(b.published_date).getTime()
  );

  const firstTime = new Date(sorted[0].published_date).getTime();
  const lastTime = new Date(sorted[sorted.length - 1].published_date).getTime();
  const totalSpan = lastTime - firstTime;
  if (totalSpan === 0) return null;

  // Build step data: each article adds to the cumulative count
  const steps = sorted.map((article, i) => {
    const offset = new Date(article.published_date).getTime() - firstTime;
    const xPercent = (offset / totalSpan) * 100;
    return {
      x: xPercent,
      y: i + 1,
      source: article.source.name,
      time: new Date(article.published_date),
    };
  });

  const maxY = steps.length;
  const chartHeight = 120;

  return (
    <section className="mb-12">
      <h2 className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-4 border-b border-[var(--border)] pb-2">
        Coverage Velocity
      </h2>
      <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-card)] p-5">
        {/* Chart */}
        <div className="relative" style={{ height: `${chartHeight + 40}px` }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between">
            <span className="font-data text-[9px] text-[var(--foreground-muted)]">{maxY}</span>
            <span className="font-data text-[9px] text-[var(--foreground-muted)]">0</span>
          </div>

          {/* Chart area */}
          <div className="ml-10 relative" style={{ height: `${chartHeight}px` }}>
            {/* Horizontal grid lines */}
            {Array.from({ length: Math.min(maxY + 1, 6) }).map((_, i) => {
              const yPos = (i / Math.min(maxY, 5)) * 100;
              return (
                <div
                  key={`grid-${i}`}
                  className="absolute left-0 right-0 border-t border-[var(--border)] opacity-30"
                  style={{ bottom: `${yPos}%` }}
                />
              );
            })}

            {/* Step line + dots */}
            <svg
              className="absolute inset-0 w-full h-full overflow-visible"
              preserveAspectRatio="none"
              viewBox={`0 0 100 ${maxY}`}
            >
              {/* Step path */}
              <path
                d={steps
                  .map((step, i) => {
                    const y = maxY - step.y;
                    if (i === 0) return `M ${step.x} ${y}`;
                    const prevX = steps[i - 1].x;
                    return `H ${step.x} V ${y}`;
                  })
                  .join(' ') + ` H 100`}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="0.8"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Fill area */}
              <path
                d={
                  steps
                    .map((step, i) => {
                      const y = maxY - step.y;
                      if (i === 0) return `M ${step.x} ${maxY} V ${y}`;
                      return `H ${step.x} V ${y}`;
                    })
                    .join(' ') + ` H 100 V ${maxY} Z`
                }
                fill="var(--accent)"
                opacity="0.08"
              />
            </svg>

            {/* Dots and hover tooltips */}
            {steps.map((step, i) => (
              <div
                key={i}
                className="absolute group z-10"
                style={{
                  left: `${step.x}%`,
                  bottom: `${(step.y / maxY) * 100}%`,
                  transform: 'translate(-50%, 50%)',
                }}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full border-2 border-[var(--surface-elevated)] ${
                    i === 0 ? 'bg-[var(--accent)]' : 'bg-[var(--foreground-muted)]'
                  }`}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  <div className="bg-[var(--foreground)] text-[var(--background)] px-2 py-1 rounded-sm whitespace-nowrap">
                    <span className="font-data text-[9px] block">{step.source}</span>
                    <span className="font-data text-[8px] opacity-70">
                      {step.time.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* X-axis labels */}
          <div className="ml-10 flex justify-between mt-2">
            <span className="font-data text-[9px] text-[var(--foreground-muted)]">First report</span>
            <span className="font-data text-[9px] text-[var(--foreground-muted)]">Latest</span>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-4 border-t border-[var(--border)] pt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            <span className="font-data text-[9px] text-[var(--foreground-muted)]">
              Cumulative source count over time
            </span>
          </div>
          <span className="font-data text-[9px] text-[var(--foreground-muted)] opacity-60">
            {maxY} sources in {formatDistanceToNow(new Date(sorted[0].published_date))}
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * RelatedStoriesSection — Horizontal scroll of semantically related stories
 */
function RelatedStoriesSection({ stories }: { stories: StoryDetail[] }) {
  if (stories.length === 0) return null;

  return (
    <section className="py-8 border-t border-[var(--border)]">
      <h2 className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-5 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4"/>
          <path d="M12 8h.01"/>
        </svg>
        Related Stories
      </h2>
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-1 px-1">
        {stories.map((story) => (
          <Link
            key={story.slug}
            href={`/story/${story.slug}`}
            className="snap-start flex-none w-64 sm:w-72 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-card)] p-4 hover:border-[var(--foreground-muted)] transition-colors group"
          >
            {story.image_url && (
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-sm mb-3 bg-[var(--surface)]">
                <img
                  src={story.image_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            )}
            <h3 className="font-display text-[14px] font-semibold text-[var(--foreground)] leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-3 mb-2">
              {story.title}
            </h3>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 font-data text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                story.status === 'corroborated'
                  ? 'text-[var(--verified-teal)] bg-[var(--verified-teal)]/10'
                  : story.status === 'developing'
                  ? 'text-[var(--signal-amber)] bg-[var(--signal-amber)]/10'
                  : 'text-[var(--foreground-muted)] bg-[var(--surface)]'
              }`}>
                {story.source_count} {story.source_count === 1 ? 'source' : 'sources'}
              </span>
              {story.categories?.[0] && (
                <span className="font-data text-[9px] text-[var(--foreground-muted)] uppercase tracking-wider">
                  {story.categories[0]}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { storyId } = await params;

  // Fetch story and related stories in parallel
  const [story, relatedStories] = await Promise.all([
    fetchStory(storyId),
    fetchRelatedStories(storyId),
  ]);

  if (!story) notFound();

  const primaryArticle = story.articles[0];
  const firstSeenDate = new Date(story.first_seen_at);
  const sortedArticles = [...story.articles].sort(
    (a, b) => new Date(a.published_date).getTime() - new Date(b.published_date).getTime()
  );
  const firstTimelineDate = sortedArticles.length > 0
    ? new Date(sortedArticles[0].published_date)
    : new Date();

  const isVerified = story.status === 'corroborated';
  const isDeveloping = story.status === 'developing';

  return (
    <div className="max-w-4xl mx-auto">
      <StickyStoryNav
        title={story.title}
        sourceCount={story.source_count}
        isVerified={isVerified}
        isDeveloping={isDeveloping}
        shareUrl={`https://ultra-news.demo/story/${story.slug}`}
      />
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

      {/* Back nav & Actions */}
      <nav className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-data text-[11px] font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          Back to Wire
        </Link>
        <ExportBriefButton story={story} />
      </nav>

      {/* Story Header */}
      <header className="mb-10 border-b-2 border-[var(--foreground)] pb-8">
        {/* Categories */}
        <div className="flex items-center gap-2 mb-4">
          {story.categories.map((cat) => (
            <CategoryPill key={cat} label={cat} href={`/${cat}`} />
          ))}
          {isVerified && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[var(--verified-teal)]/20 border border-[var(--verified-teal)]/30">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--verified-teal)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              <span className="font-data text-[9px] font-bold uppercase tracking-wider text-[var(--verified-teal)]">Verified</span>
            </span>
          )}
          {isDeveloping && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[var(--signal-amber)]/20 border border-[var(--signal-amber)]/30">
              <span className="font-data text-[9px] font-bold uppercase tracking-wider text-[var(--signal-amber)]">Developing</span>
            </span>
          )}
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

        {/* Corroboration Meter + Independent Count — full size */}
        <div className="flex flex-wrap items-center gap-4 p-4 bg-[var(--surface-elevated)] rounded-[var(--radius-card)] border border-[var(--border)]">
          <CorroborationMeter sourceCount={story.source_count} size="lg" showLabel />
          <div className="h-6 w-px bg-[var(--border)]" />

          {/* Independent count — prominently displayed */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-data text-[15px] font-bold text-[var(--foreground)]">
                {story.independent_count}
              </span>
              <span className="font-data text-[11px] text-[var(--foreground-muted)]">
                independent {story.independent_count === 1 ? 'domain' : 'domains'}
              </span>
            </div>
            {story.source_count !== story.independent_count && (
              <span className="font-data text-[9px] text-[var(--foreground-muted)] opacity-60">
                {story.source_count} total articles from {story.independent_count} independent {story.independent_count === 1 ? 'outlet' : 'outlets'}
              </span>
            )}
          </div>

          <div className="h-6 w-px bg-[var(--border)] hidden sm:block" />

          {/* Velocity score */}
          {story.velocity_score > 0 && (
            <div className="hidden sm:flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <span className="font-data text-[13px] font-bold text-[var(--accent)]">
                  {story.velocity_score.toFixed(1)}
                </span>
                <span className="font-data text-[10px] text-[var(--foreground-muted)]">v/hr</span>
              </div>
              <span className="font-data text-[9px] text-[var(--foreground-muted)] opacity-60">
                Coverage velocity
              </span>
            </div>
          )}

          <div className="h-6 w-px bg-[var(--border)] hidden sm:block" />

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

      {/* Coverage Velocity Chart */}
      <CoverageVelocityChart articles={story.articles} />

      {/* Side-by-Side Headline Framing Comparison */}
      {story.source_count > 1 && (
        <section className="mb-12">
          <h2 className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-4 border-b border-[var(--border)] pb-2">
            Side-by-Side Headline Framing
          </h2>
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4">
            {sortedArticles.map((article) => {
              // Source initial letter for badge
              const initial = article.source.name.charAt(0).toUpperCase();

              return (
                <div
                  key={`frame-${article.slug}`}
                  className="snap-start flex-none min-w-[260px] max-w-[320px] flex-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-card)] p-5 flex flex-col justify-between hover:border-[var(--foreground-muted)] transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      {/* Source initial badge */}
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-data text-[10px] font-bold">
                        {initial}
                      </span>
                      <SourceChip name={article.source.name} />
                    </div>
                    <h3 className="font-display text-[15px] font-bold text-[var(--foreground)] leading-snug mb-3">
                      &ldquo;{article.title}&rdquo;
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
              );
            })}
          </div>
        </section>
      )}

      {/* Story Timeline — chronological evolution */}
      <section className="mb-12">
        <h2 className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-6 border-b border-[var(--border)] pb-2 flex justify-between items-end">
          <span>Story Timeline ({story.source_count} {story.source_count === 1 ? 'source' : 'sources'})</span>
          <span className="font-normal opacity-60">Earliest report first ↓</span>
        </h2>

        <div className="relative border-l-2 border-[var(--border)] ml-2 sm:ml-4 pl-5 sm:pl-8 space-y-8">
          {sortedArticles.map((article, i) => {
            const articleDate = new Date(article.published_date);
            const isFirst = i === 0;
            const minutesDelta = differenceInMinutes(articleDate, firstTimelineDate);
            const hours = Math.floor(minutesDelta / 60);
            const mins = minutesDelta % 60;
            let deltaStr = '';
            if (hours > 0) deltaStr += `${hours}h `;
            deltaStr += `${mins}m`;

            // Cumulative source count at this timeline point
            const cumulativeCount = i + 1;

            return (
              <div
                key={article.slug}
                className="relative flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-5 group"
              >
                {/* Timeline node */}
                <div className={`absolute -left-[27px] sm:-left-[35px] top-2 flex items-center justify-center ${
                  isFirst ? 'w-4 h-4' : 'w-3 h-3'
                }`}>
                  <div className={`rounded-full border-2 border-[var(--surface)] ${
                    isFirst
                      ? 'w-4 h-4 bg-[var(--accent)]'
                      : 'w-3 h-3 bg-[var(--border)]'
                  }`} />
                  {/* Pulse animation on first node */}
                  {isFirst && (
                    <div className="absolute inset-0 rounded-full bg-[var(--accent)] animate-ping opacity-30" />
                  )}
                </div>

                {/* Source + timestamp */}
                <div className="flex-shrink-0 sm:w-44 pt-0.5">
                  <div className="flex items-center gap-2">
                    <SourceChip name={article.source.name} />
                    {/* Cumulative count badge */}
                    <span className="inline-flex items-center gap-0.5 font-data text-[9px] font-bold text-[var(--foreground-muted)] bg-[var(--surface-elevated)] border border-[var(--border)] px-1.5 py-0.5 rounded-sm">
                      {cumulativeCount}/{story.source_count}
                    </span>
                  </div>
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

                {/* Article angle / framing */}
                <div className="flex-1 min-w-0 bg-[var(--surface-elevated)] p-4 rounded-[var(--radius-card)] border border-[var(--border)] transition-colors group-hover:border-[var(--foreground-muted)]">
                  <h3 className="text-[15px] sm:text-[16px] font-display font-semibold text-[var(--foreground)] leading-snug mb-2">
                    &ldquo;{article.title}&rdquo;
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
          })}
        </div>
      </section>

      {/* Related Stories — powered by pgvector semantic similarity */}
      <RelatedStoriesSection stories={relatedStories} />
    </div>
  );
}
