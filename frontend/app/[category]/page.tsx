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
        <div className="space-y-16">
            {/* Header */}
            <header className="text-center max-w-4xl mx-auto pt-8">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground tracking-tight leading-[1.1] mb-4">
                    {capitalize(category)}
                    <span className="text-accent">.</span>
                </h1>
                <p className="text-lg text-foreground-muted">
                    The latest stories in {category}.
                </p>
            </header>

            {/* Content */}
            {articles.length === 0 ? (
                <div className="py-20 text-center border-t border-[var(--border)]">
                    <p className="text-[var(--foreground-muted)] font-mono">No data visible.</p>
                </div>
            ) : (
                <div>
                    {/* Hero Story (First Article) */}
                    {heroArticle && (
                        <section className="mb-16">
                            <HeroStory
                                title={heroArticle.title}
                                slug={heroArticle.slug}
                                source={heroArticle.source.name}
                                url={heroArticle.url}
                                imageUrl={heroArticle.image_url}
                                publishedDate={heroArticle.published_date}
                                category={capitalize(category)}
                            />
                        </section>
                    )}

                    {/* The List (Remaining Articles) */}
                    {feedArticles.length > 0 && (
                        <section>
                            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-4 border-b border-[var(--border)] pb-2 flex justify-between items-center">
                                <span>Recent Stories {page > 1 && `(Page ${page})`}</span>
                                <span>{totalCount} Total</span>
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
                    <Pagination
                        currentPage={page}
                        hasNext={hasNext}
                        baseUrl={`/${category}`}
                        searchParams={resolvedSearchParams}
                    />
                </div>
            )}
        </div>
    );
}
