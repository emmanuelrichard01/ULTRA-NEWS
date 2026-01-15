'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SearchBar() {
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

    // Sync input with URL on mount (so refreshing preserves search)
    useEffect(() => {
        const urlQuery = searchParams.get('q');
        if (urlQuery) {
            setQuery(urlQuery);
        }
    }, [searchParams]);

    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            setIsSearching(true);
            router.push(`/?q=${encodeURIComponent(query.trim())}`);
            inputRef.current?.blur();
            // Reset loading state after navigation
            setTimeout(() => setIsSearching(false), 500);
        }
    }, [query, router]);

    const handleClear = useCallback(() => {
        setQuery('');
        router.push('/');
        inputRef.current?.focus();
    }, [router]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + K to focus
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
            // Escape to clear and blur
            if (e.key === 'Escape' && document.activeElement === inputRef.current) {
                e.preventDefault();
                if (query) {
                    setQuery('');
                } else {
                    inputRef.current?.blur();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [query]);

    return (
        <form onSubmit={handleSearch} className="relative w-full max-w-lg group">
            <div className={`
                flex items-center gap-3 py-2.5 px-4
                bg-[var(--background-elevated)] 
                border rounded-lg
                transition-all duration-200
                ${isFocused
                    ? 'border-[var(--accent-secondary)] shadow-sm shadow-[var(--accent-secondary)]/20'
                    : 'border-[var(--border)] hover:border-[var(--border-hover)]'
                }
            `}>
                {/* Search Icon / Loading Spinner */}
                <button
                    type="submit"
                    className="focus:outline-none focus:ring-0 cursor-pointer flex-shrink-0"
                    aria-label="Search"
                    disabled={isSearching}
                >
                    {isSearching ? (
                        <svg
                            className="w-4 h-4 animate-spin text-[var(--accent-secondary)]"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className={`w-4 h-4 transition-colors ${isFocused ? 'text-[var(--accent-secondary)]' : 'text-[var(--foreground-muted)]'}`}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                    )}
                </button>

                {/* Input Field */}
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Search articles..."
                    className="
                        flex-1 min-w-0
                        bg-transparent border-none 
                        text-[var(--foreground)] text-sm font-medium
                        placeholder-[var(--foreground-muted)]
                        focus:outline-none
                    "
                />

                {/* Clear Button (when query exists) */}
                {query && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="flex-shrink-0 p-1 rounded-full text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
                        aria-label="Clear search"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}

                {/* Keyboard Shortcut Hint */}
                {!query && !isFocused && (
                    <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                        <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[var(--foreground-muted)] bg-[var(--background)] border border-[var(--border)] rounded">⌘K</kbd>
                    </div>
                )}
            </div>
        </form>
    );
}
