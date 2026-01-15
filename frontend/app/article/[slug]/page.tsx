import Link from 'next/link';
import { Metadata } from 'next';
import { formatDistanceToNow } from 'date-fns';

interface Source {
    name: string;
}

interface ArticleDetail {
    id: number;
    title: string;
    slug: string;
    url: string;
    image_url?: string;
    content: string;
    published_date: string;
    source: Source;
}

async function getArticle(slug: string): Promise<ArticleDetail | null> {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';

    try {
        const res = await fetch(`${API_URL}/api/articles/${slug}`, { cache: 'no-store' });
        if (!res.ok) {
            return null;
        }
        return res.json();
    } catch (error) {
        console.error("Error fetching article:", error);
        return null;
    }
}

interface PageProps {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const article = await getArticle(slug);

    if (!article) {
        return {
            title: "Article Not Found",
        };
    }

    return {
        title: article.title,
        description: `Read the full story from ${article.source.name} on Ultra News.`,
        openGraph: {
            title: article.title,
            description: `Read the full story from ${article.source.name} on Ultra News.`,
            url: `https://ultra-news.demo/article/${article.slug}`,
            type: "article",
            publishedTime: article.published_date,
            authors: [article.source.name],
            images: article.image_url ? [{ url: article.image_url }] : [],
        },
        twitter: {
            card: "summary_large_image",
            title: article.title,
            description: `Read more on Ultra News.`,
            images: article.image_url ? [article.image_url] : [],
        },
    };
}

export default async function ArticlePage({ params }: PageProps) {
    const { slug } = await params;
    const article = await getArticle(slug);

    if (!article) {
        return (
            <div className="py-20 text-center">
                <h1 className="text-2xl font-bold mb-4">Article not found</h1>
                <Link href="/" className="text-accent hover:underline">Return Home</Link>
            </div>
        );
    }

    const dateObj = new Date(article.published_date);

    return (
        <article className="max-w-3xl mx-auto pt-8 pb-20">
            {/* Header */}
            <header className="mb-10 text-center">
                <div className="flex items-center justify-center gap-2 mb-6">
                    <span className="text-sm font-bold uppercase tracking-wider text-accent">
                        {article.source.name}
                    </span>
                    <span className="text-gray-400 dark:text-gray-600 text-xs">•</span>
                    <time className="text-sm text-gray-600 dark:text-gray-400" dateTime={dateObj.toISOString()}>
                        {formatDistanceToNow(dateObj, { addSuffix: true })}
                    </time>
                </div>

                <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground leading-tight tracking-tight mb-8">
                    {article.title}
                </h1>

                {article.image_url && (
                    <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 mb-8">
                        <img src={article.image_url} alt="" className="object-cover w-full h-full" />
                    </div>
                )}

                <div className="flex items-center justify-center gap-4 border-t border-b border-gray-100 dark:border-gray-800 py-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-semibold text-foreground">Read time:</span> 4 min
                    </div>
                    <div className="h-4 w-px bg-gray-300 dark:bg-gray-700"></div>
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-accent hover:text-accent/80 flex items-center gap-1">
                        Read Original
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
                            <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
                        </svg>
                    </a>
                </div>
            </header>

            {/* Body Content */}
            <div className="prose prose-lg dark:prose-invert max-w-none font-serif leading-relaxed 
                text-black dark:text-gray-300 
                prose-headings:text-black dark:prose-headings:text-white 
                prose-p:text-black dark:prose-p:text-gray-300 
                prose-strong:text-black dark:prose-strong:text-white
                prose-li:text-black dark:prose-li:text-gray-300
                prose-a:text-[var(--accent)] hover:prose-a:text-[var(--accent-secondary)]">
                {article.content ? (
                    <div dangerouslySetInnerHTML={{ __html: article.content }} />
                ) : (
                    <div className="italic text-gray-500 text-center py-10 bg-gray-50 dark:bg-white/5 rounded-lg">
                        <p>Full content not available in this preview.</p>
                        <div className="mt-4">
                            <a href={article.url} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity">
                                Continue reading on {article.source.name}
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </article>
    );
}
