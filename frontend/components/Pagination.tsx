import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'; // ensure you have heroicons or standard svg

interface PaginationProps {
    currentPage: number;
    // We might not know total pages if API doesn't return count easily with basic paginator, 
    // but usually standard paginators do. 
    // For now, let's assume valid next/prev logic or just a simple standard approach.
    hasNext: boolean;
    baseUrl: string;
    searchParams?: { [key: string]: string | string[] | undefined };
}

export default function Pagination({ currentPage, hasNext, baseUrl, searchParams }: PaginationProps) {
    // Helper to build URL
    const buildUrl = (page: number) => {
        const params = new URLSearchParams();
        if (searchParams) {
            Object.entries(searchParams).forEach(([key, value]) => {
                if (key !== 'page' && typeof value === 'string') {
                    params.set(key, value);
                }
            });
        }
        params.set('page', page.toString());
        return `${baseUrl}?${params.toString()}`;
    };

    return (
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-8 mt-12">
            <div className="flex w-0 flex-1">
                {currentPage > 1 ? (
                    <Link
                        href={buildUrl(currentPage - 1)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors pr-4 py-2"
                    >
                        {/* Arrow Left */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                        Previous
                    </Link>
                ) : (
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--border)] pr-4 py-2 cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                        Previous
                    </span>
                )}
            </div>

            <div className="hidden md:flex">
                <span className="text-sm font-medium text-[var(--foreground)] px-4 py-2">
                    Page {currentPage}
                </span>
            </div>

            <div className="flex w-0 flex-1 justify-end">
                {hasNext ? (
                    <Link
                        href={buildUrl(currentPage + 1)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors pl-4 py-2"
                    >
                        Next
                        {/* Arrow Right */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m9 18 6-6-6-6" />
                        </svg>
                    </Link>
                ) : (
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--border)] pl-4 py-2 cursor-not-allowed">
                        Next
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m9 18 6-6-6-6" />
                        </svg>
                    </span>
                )}
            </div>
        </div>
    );
}
