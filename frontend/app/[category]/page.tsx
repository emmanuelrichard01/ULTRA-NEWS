import HeroStory from '@/components/HeroStory';
import FeedItem from '@/components/FeedItem';
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

async function getArticles(category: string, page: number = 1): Promise<PaginatedResponse> {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
    const limit = 20;
    const offset = (page - 1) * limit;

    const params = new URLSearchParams();
    params.set('category', category);
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

interface CategoryPageProps {
    params: Promise<{ category: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
    const { category } = await params;
    const resolvedSearchParams = await searchParams;
    const page = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page) : 1;

    const data = await getArticles(category, page);
    const articles = data.items;
    const totalCount = data.count;

    const showHero = page === 1 && articles.length > 0;
    const heroArticle = showHero ? articles[0] : null;
    const feedArticles = showHero ? articles.slice(1) : articles;

    const hasNext = (page * 20) < totalCount;

    return (
        <div className="space-y-20 pb-20">
            {/* Editorial Header */}
            <header className="pt-12 sm:pt-20 border-b border-[var(--border)] pb-8">
                <div className="flex flex-col gap-4">
                    <span className="text-xs font-bold tracking-widest uppercase text-[var(--accent)]">
                        Topic
                    </span>
                    <h1 className="text-6xl sm:text-8xl font-black text-[var(--foreground)] tracking-tighter leading-[0.9] font-display uppercase">
                        {category}
                    </h1>
                    <p className="text-xl sm:text-2xl text-[var(--foreground-muted)] max-w-2xl font-serif italic antialiased opacity-80 decoration-slice">
                        Curated stories and breaking news from the world of {category}.
                    </p>
                </div>
            </header>

            {/* Content */}
            {articles.length === 0 ? (
                <div className="py-32 flex flex-col items-center justify-center border-b border-[var(--border)] bg-[var(--background-elevated)]/30 rounded-lg border-dashed">
                    <div className="w-16 h-16 mb-6 rounded-full bg-[var(--background-elevated)] flex items-center justify-center">
                        <span className="text-2xl text-[var(--foreground-muted)] opacity-50">?</span>
                    </div>
                    <h3 className="text-xl font-bold text-[var(--foreground)] mb-2 tracking-tight">No stories found</h3>
                    <p className="text-[var(--foreground-muted)] font-mono text-sm">We couldn't find any articles for this category yet.</p>
                </div>
            ) : (
                <div className="space-y-16">
                    {/* Hero Story (First Article) */}
                    {heroArticle && (
                        <section>
                            <HeroStory
                                title={heroArticle.title}
                                slug={heroArticle.slug}
                                source={heroArticle.source.name}
                                url={heroArticle.url}
                                imageUrl={heroArticle.image_url}
                                publishedDate={heroArticle.published_date}
                                category={capitalize(category)}
                                summary="Top story of the moment." // Placeholder summary
                            />
                        </section>
                    )}

                    {/* The List (Remaining Articles) */}
                    {feedArticles.length > 0 && (
                        <section className="max-w-4xl">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-8 flex items-center gap-4">
                                <span className="bg-[var(--foreground)] text-[var(--background)] px-2 py-0.5">Latest</span>
                                <span className="flex-1 h-px bg-[var(--border)]"></span>
                                <span>Page {page}</span>
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

                    {/* Pagination */}
                    <div className="pt-8 border-t border-[var(--border)]">
                        <Pagination
                            currentPage={page}
                            hasNext={hasNext}
                            baseUrl={`/${category}`}
                            searchParams={resolvedSearchParams}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
