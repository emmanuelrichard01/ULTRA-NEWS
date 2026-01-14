import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface HeroStoryProps {
    title: string;
    slug?: string;
    source: string;
    url: string;
    imageUrl?: string | null;
    publishedDate: string | Date;
    summary?: string;
    category?: string;
}

export default function HeroStory({ title, slug, source, url, imageUrl, publishedDate, summary, category }: HeroStoryProps) {
    const dateObj = typeof publishedDate === 'string' ? new Date(publishedDate) : publishedDate;
    const articleLink = slug ? `/article/${slug}` : url;

    return (
        <article className="group relative mb-16">
            <Link href={articleLink} className="block group">
                {/* Image - Cinematic 21:9 */}
                <div className="relative aspect-[16/9] sm:aspect-[2/1] lg:aspect-[21/9] w-full overflow-hidden rounded-[2px] mb-6">
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={title}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out will-change-transform"
                        />
                    ) : (
                        <div className="absolute inset-0 bg-[var(--background-elevated)] border border-[var(--border)]" />
                    )}
                    {/* Subtle Overlay */}
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-500" />
                </div>

                {/* Content - Editorial Layout */}
                <div className="max-w-4xl">
                    <div className="flex items-baseline gap-3 mb-3">
                        {category && (
                            <span className="text-xs font-bold tracking-widest uppercase text-[var(--accent)]">
                                {category}
                            </span>
                        )}
                        <span className="text-xs font-bold tracking-widest uppercase text-[var(--foreground-muted)]">
                            {source}
                        </span>
                        <span className="text-xs text-[var(--foreground-muted)]">•</span>
                        <time className="text-xs font-medium text-[var(--foreground-muted)]">
                            {formatDistanceToNow(dateObj, { addSuffix: true })}
                        </time>
                    </div>

                    <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[0.95] tracking-tighter text-[var(--foreground)] mb-4 font-display group-hover:text-[var(--accent)] transition-colors duration-200">
                        {title}
                    </h1>

                    {summary && (
                        <p className="text-xl sm:text-2xl text-[var(--foreground-muted)] leading-relaxed font-serif antialiased max-w-3xl opacity-80">
                            {summary}
                        </p>
                    )}
                </div>
            </Link>
        </article>
    );
}
