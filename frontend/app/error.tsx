"use client";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const isDev = process.env.NODE_ENV === 'development';

    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="max-w-md w-full text-center p-8">
                {/* Wire-red accent for error state */}
                <div className="w-12 h-12 rounded-full bg-[var(--wire-red)] flex items-center justify-center mx-auto mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                        <path d="M12 9v4" />
                        <path d="M12 17h.01" />
                    </svg>
                </div>

                <h1 className="text-display-md font-display text-[var(--foreground)] mb-2">
                    Signal Lost
                </h1>
                <p className="text-body-md text-[var(--foreground-muted)] mb-6">
                    Something went wrong loading this page.
                </p>

                {isDev && (
                    <details className="text-left mb-6 p-4 bg-[var(--surface-elevated)] rounded-[var(--radius-card)] border border-[var(--border)]">
                        <summary className="font-data text-[11px] text-[var(--wire-red)] cursor-pointer font-semibold uppercase tracking-wider">
                            Error Details
                        </summary>
                        <pre className="mt-3 font-data text-[11px] text-[var(--foreground-muted)] overflow-auto whitespace-pre-wrap">
                            {error.message}
                        </pre>
                    </details>
                )}

                <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--foreground)] text-[var(--background)] font-data text-sm font-bold uppercase tracking-wider rounded-[var(--radius-card)] hover:opacity-90 transition-opacity duration-150"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /><polyline points="22 2 22 8 16 8" /></svg>
                    Retry
                </button>
            </div>
        </div>
    );
}
