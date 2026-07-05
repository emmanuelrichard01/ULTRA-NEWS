import StoryCard from '@/components/StoryCard';
import SearchBar from '@/components/SearchBar';

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

interface PaginatedResponse {
  items: StoryDetail[];
  next_cursor?: string;
  count: number;
}

async function getStories(query?: string, cursor?: string): Promise<PaginatedResponse> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  const limit = 20;

  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());
  params.set('status', 'corroborated'); // Filter to corroborated stories

  const endpoint = `/api/v1/stories?${params.toString()}`;

  try {
    const res = await fetch(`${API_URL}${endpoint}`, { next: { revalidate: 60 } });
    if (!res.ok) {
      console.error(`Failed to fetch data: ${res.status}`);
      return { items: [], count: 0 };
    }
    return res.json();
  } catch (error) {
    console.error("Error fetching stories:", error);
    return { items: [], count: 0 };
  }
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ReportingPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const q = typeof resolvedSearchParams.q === 'string' ? resolvedSearchParams.q : undefined;
  const cursor = typeof resolvedSearchParams.cursor === 'string' ? resolvedSearchParams.cursor : undefined;

  const data = await getStories(q, cursor);
  const stories = data.items;
  const totalCount = data.count;

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* Header */}
      <header className="border-b-2 border-[var(--verified-teal)] pb-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-display-xl font-display text-[var(--foreground)] uppercase">
                Reporting
              </h1>
              {totalCount > 0 && (
                <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1 font-data text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] border border-[var(--border)] rounded-[var(--radius-chip)] bg-[var(--background)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--verified-teal)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--verified-teal)]"></span>
                  </span>
                  {totalCount.toLocaleString()} reporting
                </span>
              )}
            </div>
            <p className="text-body-md text-[var(--foreground-muted)] max-w-xl">
              Verified intelligence corroborated by 3 or more independent sources.
            </p>
          </div>
          <div className="w-full md:w-auto">
            <SearchBar />
          </div>
        </div>
      </header>

      {/* Content */}
      {stories.length === 0 ? (
        <div className="py-20 text-center border-t border-[var(--border)]">
          <p className="font-data text-[var(--foreground-muted)]">
            {q ? `No corroborated stories found for "${q}"` : "No corroborated stories currently."}
          </p>
        </div>
      ) : (
        <div>
          {/* Feed */}
          <section>
            <div className="flex flex-col">
              {stories.map((story) => (
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
                  categories={story.categories}
                  storySlug={story.slug}
                  variant="standard"
                />
              ))}
            </div>
          </section>

          {/* Cursor Pagination */}
          {data.next_cursor && (
            <div className="flex justify-center pt-8 border-t border-[var(--border)] mt-8">
              <a
                href={`/reporting?cursor=${data.next_cursor}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                className="inline-flex items-center gap-2 px-6 py-3 font-data text-sm font-semibold text-[var(--foreground)] border border-[var(--border)] rounded-[var(--radius-card)] hover:bg-[var(--surface-elevated)] transition-colors duration-150"
              >
                Load more stories
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
