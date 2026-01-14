export default function Loading() {
    return (
        <div className="max-w-4xl mx-auto space-y-12 animate-pulse">
            {/* Header Skeleton */}
            <div className="border-b-4 border-[var(--border)] pb-6 mb-8 pt-8">
                <div className="h-16 w-3/4 bg-[var(--background-elevated)] rounded-md mb-4"></div>
                <div className="h-6 w-1/2 bg-[var(--background-elevated)] rounded-md"></div>
            </div>

            <div className="space-y-16">
                {/* Hero Skeleton */}
                <section>
                    <div className="w-full aspect-[21/9] bg-[var(--background-elevated)] rounded-lg mb-6"></div>
                    <div className="h-4 w-32 bg-[var(--background-elevated)] rounded mb-4"></div>
                    <div className="h-10 w-full bg-[var(--background-elevated)] rounded mb-4"></div>
                    <div className="h-10 w-2/3 bg-[var(--background-elevated)] rounded"></div>
                </section>

                {/* List Skeleton */}
                <section>
                    <div className="space-y-8">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex gap-6">
                                <div className="flex-shrink-0 w-24 h-24 sm:w-40 sm:h-28 bg-[var(--background-elevated)] rounded-md"></div>
                                <div className="flex-1 space-y-3 py-2">
                                    <div className="h-4 w-24 bg-[var(--background-elevated)] rounded"></div>
                                    <div className="h-6 w-full bg-[var(--background-elevated)] rounded"></div>
                                    <div className="h-6 w-3/4 bg-[var(--background-elevated)] rounded"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
