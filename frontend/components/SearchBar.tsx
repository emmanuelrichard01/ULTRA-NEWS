"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SearchBar() {
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

    // Initialize from URL
    useEffect(() => {
        const q = searchParams.get('q');
        if (q) setQuery(q);
    }, [searchParams]);

    // ⌘K shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
            if (e.key === 'Escape') {
                inputRef.current?.blur();
                setIsFocused(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            router.push(`/?q=${encodeURIComponent(query.trim())}`);
        } else {
            router.push('/');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="relative w-full max-w-sm">
            <div className={`flex items-center gap-2 px-3 py-2 border rounded-[var(--radius-card)] transition-all duration-200 ${
                isFocused
                    ? 'border-[var(--verified-teal)] bg-[var(--background)] shadow-sm shadow-[var(--verified-teal)]/10'
                    : 'border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--border-hover)]'
            }`}>
                {/* Search icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--foreground-muted)] flex-shrink-0">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                </svg>

                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Search stories..."
                    maxLength={200}
                    className="w-full bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none"
                    aria-label="Search stories"
                />

                {/* Keyboard shortcut hint */}
                {!isFocused && !query && (
                    <span className="hidden sm:flex items-center gap-0.5 font-data text-[10px] text-[var(--foreground-muted)] bg-[var(--background)] border border-[var(--border)] px-1.5 py-0.5 rounded flex-shrink-0">
                        ⌘K
                    </span>
                )}

                {/* Clear button */}
                {query && (
                    <button
                        type="button"
                        onClick={() => { setQuery(''); router.push('/'); }}
                        className="p-0.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors flex-shrink-0"
                        aria-label="Clear search"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                )}
            </div>
        </form>
    );
}
