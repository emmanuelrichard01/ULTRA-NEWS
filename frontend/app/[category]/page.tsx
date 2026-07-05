import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StoryCard from '@/components/StoryCard';
import CategoryPill from '@/components/CategoryPill';

interface StoryDetail {
  id: number;
  title: string;
  slug: string;
  summary: string;
  first_seen_at: string;
  last_updated_at: string;
  source_count: number;
  status: string;
  image_url: string | null;
  categories: string[];
  sources: string[];
}

const CATEGORY_MAP: Record<string, { displayName: string; description: string }> = {
  tech: { displayName: 'Tech', description: 'Technology, AI, and the digital frontier.' },
  politics: { displayName: 'Politics', description: 'Government, policy, and global affairs.' },
  business: { displayName: 'Business', description: 'Markets, finance, and entrepreneurship.' },
  entertainment: { displayName: 'Culture', description: 'Film, music, media, and the cultural conversation.' },
  science: { displayName: 'Science', description: 'Research, discovery, and the natural world.' },
  art: { displayName: 'Art', description: 'Visual arts, exhibitions, and creative expression.' },
};

async function getCategoryStories(category: string, cursor?: string) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  const params = new URLSearchParams({ category, limit: '20' });
  if (cursor) params.set('cursor', cursor);

  try {
    const res = await fetch(`${API_URL}/api/v1/stories?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return { items: [], count: 0 };
    return res.json();
  } catch {
    return { items: [], count: 0 };
  }
}

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ cursor?: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const info = CATEGORY_MAP[category];
  const name = info?.displayName || category.charAt(0).toUpperCase() + category.slice(1);

  return {
    title: `${name} — Ultra News`,
    description: info?.description || `Latest ${name} news from multiple sources.`,
    openGraph: {
      title: `${name} — Ultra News`,
      description: info?.description || `Latest ${name} news.`,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category } = await params;
  const resolvedSearch = await searchParams;
  const cursor = resolvedSearch.cursor;

  const info = CATEGORY_MAP[category];
  if (!info) notFound();

  const data = await getCategoryStories(category, cursor);
  const stories: StoryDetail[] = data.items;

  const heroStory = !cursor && stories.length > 0 ? stories[0] : null;
  const feedStories = heroStory ? stories.slice(1) : stories;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Category Header */}
      <header className="border-b-2 border-[var(--foreground)] pb-6">
        <div className="flex items-center gap-3 mb-1">
          <CategoryPill label={info.displayName} isActive />
          <span className="font-data text-[10px] text-[var(--foreground-muted)]">
            {data.count} stories
          </span>
        </div>
        <h1 className="text-display-xl font-display text-[var(--foreground)] mt-3">
          {info.displayName}
        </h1>
        <p className="text-body-md text-[var(--foreground-muted)] mt-2">
          {info.description}
        </p>

        {/* Related categories */}
        <div className="flex gap-2 mt-5 flex-wrap">
          {Object.entries(CATEGORY_MAP)
            .filter(([slug]) => slug !== category)
            .map(([slug, cat]) => (
              <CategoryPill key={slug} label={cat.displayName} href={`/${slug}`} />
            ))}
        </div>
      </header>

      {/* Content */}
      {stories.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-data text-[var(--foreground-muted)]">
            No stories in {info.displayName} yet. Check back soon.
          </p>
        </div>
      ) : (
        <div>
          {/* Hero */}
          {heroStory && (
            <section className="mb-12">
              <StoryCard
                title={heroStory.title}
                slug={heroStory.slug}
                imageUrl={heroStory.image_url}
                excerpt={heroStory.summary}
                publishedDate={heroStory.first_seen_at}
                sourceCount={heroStory.source_count}
                status={heroStory.status}
                sources={heroStory.sources}
                storySlug={heroStory.slug}
                categories={[info.displayName]}
                variant="hero"
              />
            </section>
          )}

          {/* Feed */}
          {feedStories.length > 0 && (
            <section>
              <h2 className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-4 border-b border-[var(--border)] pb-2 flex justify-between items-end">
                <span>Latest in {info.displayName}</span>
                <span className="font-normal opacity-60">Sorted by Trending Velocity</span>
              </h2>
              <div className="flex flex-col">
                {feedStories.map((story) => (
                  <StoryCard
                    key={story.slug}
                    title={story.title}
                    slug={story.slug}
                    imageUrl={story.image_url}
                    excerpt={story.summary}
                    publishedDate={story.first_seen_at}
                    sourceCount={story.source_count}
                    status={story.status}
                    sources={story.sources}
                    storySlug={story.slug}
                    categories={[info.displayName]}
                    variant="standard"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Cursor Pagination */}
          {data.next_cursor && (
            <div className="flex justify-center pt-8 border-t border-[var(--border)] mt-8">
              <a
                href={`/${category}?cursor=${data.next_cursor}`}
                className="inline-flex items-center gap-2 px-6 py-3 font-data text-sm font-semibold text-[var(--foreground)] border border-[var(--border)] rounded-[var(--radius-card)] hover:bg-[var(--surface-elevated)] transition-colors duration-150"
              >
                Load more
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
