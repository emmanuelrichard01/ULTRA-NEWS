export default function Loading() {
    return (
        <div className="space-y-20 pb-20 animate-pulse">
            {/* Header Skeleton (Editorial Style) */}
            <div className="pt-12 sm:pt-20 border-b border-[var(--border)] pb-8">
                <div className="flex flex-col gap-4">
                    <div className="h-4 w-16 bg-[var(--background-elevated)] rounded"></div>
                    <div className="h-16 sm:h-24 w-3/4 max-w-xl bg-[var(--background-elevated)] rounded-lg"></div>
                    <div className="h-6 w-full max-w-lg bg-[var(--background-elevated)] rounded mt-2"></div>
                </div>
            </div>

            <div className="space-y-16">
                {/* Hero Skeleton */}
                <section>
                    <div className="w-full aspect-[21/9] bg-[var(--background-elevated)] rounded-sm mb-6"></div>
                    <div className="h-4 w-32 bg-[var(--background-elevated)] rounded mb-4"></div>
                    <div className="h-10 w-full bg-[var(--background-elevated)] rounded mb-4"></div>
                    <div className="h-10 w-2/3 bg-[var(--background-elevated)] rounded"></div>
                </section>

                {/* List Skeleton */}
                <section className="max-w-4xl">
                    <div className="h-4 w-full border-b border-[var(--border)] mb-8 flex items-center gap-4">
                        <div className="h-4 w-16 bg-[var(--background-elevated)] rounded"></div>
                    </div>
                    <div className="space-y-8">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex flex-row-reverse sm:flex-row gap-6">
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
