import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface FeedItemProps {
    title: string;
    slug?: string;
    source: string;
    url: string;
    imageUrl?: string | null;
    publishedDate: string | Date;
    category?: string;
}

export default function FeedItem({ title, slug, source, url, imageUrl, publishedDate, category }: FeedItemProps) {
    const dateObj = typeof publishedDate === 'string' ? new Date(publishedDate) : publishedDate;
    const articleLink = slug ? `/article/${slug}` : url;

    return (
        <article className="group py-6 border-b border-[var(--border)] last:border-0 hover:bg-[var(--background-elevated)] transition-colors -mx-4 px-4 sm:mx-0 sm:px-0 sm:hover:bg-transparent">
            <Link href={articleLink} className="flex flex-row-reverse sm:flex-row gap-6 items-start">
                {/* Image Thumbnail - Fixed Aspect Ratio */}
                <div className="flex-shrink-0 w-24 h-24 sm:w-40 sm:h-28 relative overflow-hidden rounded-md bg-[var(--border)]">
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 will-change-transform"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-[var(--background-elevated)]">
                            <span className="text-2xl font-bold text-[var(--border)]">U</span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col h-24 sm:h-28 justify-between">
                    <div>
                        {/* Meta Top (Mobile Only) */}
                        <div className="flex sm:hidden items-center gap-2 text-[10px] text-[var(--foreground-muted)] uppercase tracking-wider font-semibold mb-1.5">
                            <span className="text-accent">{source}</span>
                            <span>•</span>
                            <time>{formatDistanceToNow(dateObj, { addSuffix: true })}</time>
                        </div>

                        {/* Title */}
                        <h3 className="text-[17px] sm:text-[22px] font-bold text-[var(--foreground)] leading-[1.3] group-hover:text-[var(--accent)] transition-colors font-display tracking-tight">
                            {title}
                        </h3>

                        {/* Summary/Excerpt (Desktop only - implied if we had it, but here just spacing) */}
                    </div>

                    {/* Meta Bottom (Desktop) */}
                    <div className="hidden sm:flex items-center gap-3 text-xs font-semibold text-[var(--foreground-muted)] tracking-wide uppercase mt-1">
                        <span className="text-[var(--foreground)]">{source}</span>
                        <span className="text-[var(--border)]">•</span>
                        <time>{formatDistanceToNow(dateObj, { addSuffix: true })}</time>
                        {category && (
                            <>
                                <span className="text-[var(--border)]">•</span>
                                <span className="text-[var(--accent)]">{category}</span>
                            </>
                        )}
                    </div>
                </div>
            </Link>
        </article>
    );
}
