"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface HeroArticle {
    title: string;
    slug: string;
    url: string;
    image_url?: string;
    published_date: string;
    source: { name: string };
    category?: string;
    summary?: string;
}

interface HeroCarouselProps {
    articles: HeroArticle[];
}

export default function HeroCarousel({ articles }: HeroCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const nextSlide = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % articles.length);
    }, [articles.length]);

    const prevSlide = () => {
        setCurrentIndex((prev) => (prev - 1 + articles.length) % articles.length);
    };

    useEffect(() => {
        if (isPaused) return;
        const interval = setInterval(nextSlide, 6000); // 6 seconds per slide
        return () => clearInterval(interval);
    }, [isPaused, nextSlide]);

    if (!articles.length) return null;

    const currentArticle = articles[currentIndex];

    return (
        <div
            className="relative group mb-16"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Main Feature Container */}
            <div className="relative aspect-[16/9] sm:aspect-[2/1] lg:aspect-[21/9] w-full overflow-hidden rounded-[2px] bg-[var(--background-elevated)]">
                {/* Images - Stacked for crossfade */}
                {articles.map((article, idx) => (
                    <div
                        key={`${article.slug}-${idx}`}
                        className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                            }`}
                    >
                        {article.image_url ? (
                            <img
                                src={article.image_url}
                                alt={article.title}
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                        ) : (
                            <div className="absolute inset-0 bg-[var(--background-elevated)] flex items-center justify-center">
                                <span className="text-[var(--border)] text-9xl font-display font-black opacity-10">
                                    {article.source.name.charAt(0)}
                                </span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                    </div>
                ))}

                {/* Content Overlay */}
                <div className="absolute inset-0 z-20 flex flex-col justify-end p-6 sm:p-10 lg:p-12">
                    <div className="max-w-4xl transition-all duration-500 transform translate-y-0">
                        {/* Meta */}
                        <div className="flex items-center gap-3 mb-3 text-white">
                            <span className="text-xs font-bold tracking-widest uppercase text-[var(--accent-secondary)]">
                                Editor's Choice
                            </span>
                            <span className="w-1 h-1 bg-white/50 rounded-full" />
                            <span className="text-xs font-bold tracking-widest uppercase text-white/90">
                                {currentArticle.source.name}
                            </span>
                            <span className="hidden sm:inline text-xs opacity-70">
                                {formatDistanceToNow(new Date(currentArticle.published_date), { addSuffix: true })}
                            </span>
                        </div>

                        {/* Title */}
                        <Link href={currentArticle.slug ? `/article/${currentArticle.slug}` : currentArticle.url}>
                            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[0.95] tracking-tighter font-display mb-4 hover:underline decoration-4 decoration-[var(--accent-secondary)] underline-offset-4 transition-all duration-200 line-clamp-3 drop-shadow-md">
                                {currentArticle.title}
                            </h2>
                        </Link>

                        {/* Summary (Desktop) */}
                        <p className="hidden md:block text-lg lg:text-xl text-white/90 font-serif max-w-2xl line-clamp-2 leading-relaxed drop-shadow-sm">
                            {currentArticle.summary || "Full coverage and in-depth analysis on this developing story."}
                        </p>
                    </div>
                </div>

                {/* Controls */}
                <div className="absolute bottom-6 right-6 z-30 flex items-center gap-4">
                    {/* Indicators */}
                    <div className="flex gap-2">
                        {articles.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? "w-8 bg-[var(--accent-secondary)]" : "w-3 bg-white/40 hover:bg-white/60"
                                    }`}
                                aria-label={`Go to slide ${idx + 1}`}
                            />
                        ))}
                    </div>

                    {/* Arrows */}
                    <div className="hidden sm:flex gap-2 ml-4">
                        <button
                            onClick={prevSlide}
                            className="p-2 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-md transition-colors border border-white/20"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <button
                            onClick={nextSlide}
                            className="p-2 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-md transition-colors border border-white/20"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
