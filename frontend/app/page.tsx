import HeroCarousel from '@/components/HeroCarousel';
import FeedItem from '@/components/FeedItem';
import SearchBar from '@/components/SearchBar';
import Pagination from '@/components/Pagination';

// Define types based on API response
interface Source {
  name: string;
}

interface Article {
  title: string;
  slug: string;
  url: string;
  image_url?: string;
  published_date: string;
  source: Source;
}

interface PaginatedResponse {
  items: Article[];
  count: number;
}

async function getArticles(query?: string, page: number = 1): Promise<PaginatedResponse> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
  const limit = 20; // Page size
  const offset = (page - 1) * limit;

  // Ninja Pagination uses limit/offset by default
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  params.set('limit', limit.toString());
  params.set('offset', offset.toString());

  const endpoint = `/api/news?${params.toString()}`;

  try {
    const res = await fetch(`${API_URL}${endpoint}`, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`Failed to fetch data: ${res.status}`);
      return { items: [], count: 0 };
    }
    return res.json();
  } catch (error) {
    console.error("Error fetching articles:", error);
    return { items: [], count: 0 };
  }
}

interface HomeProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const q = typeof resolvedSearchParams.q === 'string' ? resolvedSearchParams.q : undefined;
  const page = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page) : 1;

  const data = await getArticles(q, page);
  const articles = data.items;
  const totalCount = data.count;

  // Layout logic
  // If page 1: Show Hero Carousel (Top 5) + List
  // If page > 1: Show List only (Carousel irrelevant for p2)
  const showHero = page === 1 && articles.length > 0;

  const carouselArticles = showHero ? articles.slice(0, 5) : [];
  const feedArticles = showHero ? articles.slice(5) : articles;

  const hasNext = (page * 20) < totalCount;

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Simple Editorial Header */}
      <header className="border-b-4 border-[var(--foreground)] pb-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-6xl md:text-8xl font-[900] tracking-tighter leading-none text-[var(--foreground)] font-display uppercase">
                The Feed
              </h1>
              {totalCount > 0 && (
                <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] border border-[var(--border)] rounded-full bg-[var(--background)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  {totalCount.toLocaleString()} Stories
                </span>
              )}
            </div>
            <p className="text-lg font-medium text-[var(--foreground-muted)] max-w-xl">
              Curated intelligence for the accelerated mind.
            </p>
          </div>
          <div className="w-full md:w-auto">
            <SearchBar />
          </div>
        </div>
      </header>

      {/* Content */}
      {articles.length === 0 ? (
        <div className="py-20 text-center border-t border-[var(--border)]">
          <p className="text-[var(--foreground-muted)] font-mono">System Offline. Connecting...</p>
        </div>
      ) : (
        <div>
          {/* Top Stories Carousel (Page 1 Only) */}
          {showHero && (
            <section className="mb-20">
              <HeroCarousel articles={carouselArticles} />
            </section>
          )}

          {/* The List (Remaining Articles) */}
          {feedArticles.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-4 border-b border-[var(--border)] pb-2">
                Latest Wire {page > 1 && `(Page ${page})`}
              </h2>
              <div className="flex flex-col">
                {feedArticles.map((article, idx) => (
                  <FeedItem
                    key={idx}
                    title={article.title}
                    slug={article.slug}
                    source={article.source.name}
                    url={article.url}
                    imageUrl={article.image_url}
                    publishedDate={article.published_date}
                    highlightQuery={q}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Pagination */}
          <Pagination
            currentPage={page}
            hasNext={hasNext}
            totalCount={totalCount}
            baseUrl="/"
            searchParams={resolvedSearchParams}
          />
        </div>
      )}
    </div>
  );
}
