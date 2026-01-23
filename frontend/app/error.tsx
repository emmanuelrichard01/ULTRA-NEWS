'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log error to console (could integrate with error tracking service)
        console.error('Application error:', error);
    }, [error]);

    return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-4">
            <div className="space-y-6 max-w-md">
                <div className="space-y-2">
                    <h1 className="text-4xl font-[900] tracking-tight text-[var(--foreground)]">
                        Something went wrong
                    </h1>
                    <p className="text-[var(--foreground-muted)]">
                        We encountered an unexpected error. Please try again.
                    </p>
                </div>

                <button
                    onClick={reset}
                    className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] font-bold uppercase tracking-wider text-sm hover:opacity-90 transition-opacity"
                >
                    Try Again
                </button>

                {process.env.NODE_ENV === 'development' && (
                    <details className="mt-6 text-left text-xs text-[var(--foreground-muted)] border border-[var(--border)] p-4 rounded">
                        <summary className="cursor-pointer font-mono">Error Details</summary>
                        <pre className="mt-2 overflow-auto whitespace-pre-wrap">
                            {error.message}
                            {error.digest && `\nDigest: ${error.digest}`}
                        </pre>
                    </details>
                )}
            </div>
        </div>
    );
}
