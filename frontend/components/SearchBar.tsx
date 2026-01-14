'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SearchBar() {
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            router.push(`/?q=${encodeURIComponent(query)}`);
            inputRef.current?.blur();
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <form onSubmit={handleSearch} className="relative w-full max-w-lg">
            <div className={`
                flex items-center gap-3 py-2 px-3
                bg-[var(--background-elevated)] 
                border-b-2
                transition-colors duration-200
                ${isFocused ? 'border-[var(--accent)]' : 'border-[var(--border)]'}
            `}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    className={`w-4 h-4 ${isFocused ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'}`}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>

                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Search intelligence..."
                    className="
                        flex-1 
                        bg-transparent border-none 
                        text-[var(--foreground)] text-sm font-bold tracking-wide uppercase
                        placeholder-[var(--foreground-muted)]
                        focus:outline-none
                    "
                />

                {!query && !isFocused && (
                    <div className="flex items-center gap-1">
                        <kbd className="text-[10px] font-mono text-[var(--foreground-muted)] opacity-50">⌘K</kbd>
                    </div>
                )}
            </div>
        </form>
    );
}
