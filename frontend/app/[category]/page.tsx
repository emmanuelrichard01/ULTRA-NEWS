import HeroStory from '@/components/HeroStory';
import FeedItem from '@/components/FeedItem';

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

async function getArticles(category: string): Promise<Article[]> {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
    const endpoint = `/api/news?category=${encodeURIComponent(category)}`;

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

interface CategoryPageProps {
    params: Promise<{ category: string }>
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function CategoryPage({ params }: CategoryPageProps) {
    const { category } = await params;
    const articles = await getArticles(category);

    const heroArticle = articles.length > 0 ? articles[0] : null;
    const featuredArticles = articles.length > 1 ? articles.slice(1, 5) : [];
    const feedArticles = articles.length > 5 ? articles.slice(5) : [];

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
                <div className="py-20 text-center">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-accent/10 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-accent">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-foreground mb-2">No stories in {category} yet</h2>
                    <p className="text-foreground-muted">Check back later for updates.</p>
                </div>
            ) : (
                <div className="space-y-16">
                    {/* Hero Story */}
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
                                summary={`Featured story in ${category}.`}
                            />
                        </section>
                    )}

                    {/* Featured Grid */}
                    {featuredArticles.length > 0 && (
                        <section>
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-bold text-foreground">Trending in {capitalize(category)}</h2>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {featuredArticles.map((article, idx) => (
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

                    {/* More Stories */}
                    {feedArticles.length > 0 && (
                        <section>
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-bold text-foreground">More in {capitalize(category)}</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
