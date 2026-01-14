import HeroStory from '@/components/HeroStory';
import FeedItem from '@/components/FeedItem';
import SearchBar from '@/components/SearchBar';

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

async function getArticles(query?: string): Promise<Article[]> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
  const endpoint = query ? `/api/news?q=${encodeURIComponent(query)}` : '/api/news';

  try {
    const res = await fetch(`${API_URL}${endpoint}`, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`Failed to fetch data: ${res.status}`);
      return [];
    }
    return res.json();
  } catch (error) {
    console.error("Error fetching articles:", error);
    return [];
  }
}

interface HomeProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const q = typeof resolvedSearchParams.q === 'string' ? resolvedSearchParams.q : undefined;

  const articles = await getArticles(q);

  // Layout: 1 Hero + Rest as List (No separate featured grid to maintain "List" density)
  const heroArticle = articles.length > 0 ? articles[0] : null;
  const feedArticles = articles.length > 1 ? articles.slice(1) : [];

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Simple Editorial Header */}
      <header className="border-b-4 border-[var(--foreground)] pb-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-6xl md:text-8xl font-[900] tracking-tighter leading-none text-[var(--foreground)] mb-2 font-display uppercase">
              The Feed
            </h1>
            <p className="text-lg font-medium text-[var(--foreground-muted)] max-w-xl">
              Live intelligence stream.
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
          {/* Hero Story */}
          {heroArticle && (
            <section className="mb-16">
              <HeroStory
                title={heroArticle.title}
                slug={heroArticle.slug}
                source={heroArticle.source.name}
                url={heroArticle.url}
                imageUrl={heroArticle.image_url}
                publishedDate={heroArticle.published_date}
                category="Editor's Choice"
                summary="The most significant story of the moment, curated for depth and impact."
              />
            </section>
          )}

          {/* The List (Single Column for Density) */}
          {feedArticles.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-4 border-b border-[var(--border)] pb-2">
                Latest Wire
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
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
