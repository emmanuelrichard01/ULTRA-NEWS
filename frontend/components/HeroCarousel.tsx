"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import CorroborationMeter from './CorroborationMeter';
import CategoryPill from './CategoryPill';
import { formatDistanceToNow } from 'date-fns';

interface CarouselArticle {
  title: string;
  slug: string;
  image_url?: string;
  excerpt?: string;
  published_date: string;
  source: { name: string };
  story_slug?: string;
  story_source_count?: number;
  story_status?: string;
  categories?: string[];
}

interface HeroCarouselProps {
  articles: CarouselArticle[];
}

export default function HeroCarousel({ articles }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setTimeout(() => setIsTransitioning(false), 100);
    }, 300);
  }, [isTransitioning]);

  const goToNext = useCallback(() => {
    goToSlide((currentIndex + 1) % articles.length);
  }, [currentIndex, articles.length, goToSlide]);

  // Auto-play
  useEffect(() => {
    if (!isAutoPlaying || articles.length <= 1) return;
    const timer = setInterval(goToNext, 6000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, goToNext, articles.length]);

  if (articles.length === 0) return null;

  const article = articles[currentIndex];
  const dateObj = new Date(article.published_date);
  const link = article.story_slug ? `/story/${article.story_slug}` : `/article/${article.slug}`;
  const sourceCount = article.story_source_count || 1;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Fanned stack for multi-source stories */}
      <div className={sourceCount > 1 ? "fanned-stack" : ""}>
        <Link href={link} className="block group">
          <div className="relative aspect-[16/9] sm:aspect-[2/1] lg:aspect-[21/9] w-full overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface-elevated)]">
            {/* Image with crossfade */}
            <div className={`absolute inset-0 transition-opacity duration-700 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
              {article.image_url ? (
                <img
                  src={article.image_url}
                  alt={article.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-1000 ease-out will-change-transform"
                />
              ) : (
                <div className="absolute inset-0 bg-[var(--ink)] flex items-center justify-center">
                  <span className="text-9xl font-display font-bold text-white/5">U</span>
                </div>
              )}
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />

            {/* Content overlay */}
            <div className="absolute inset-0 z-20 flex flex-col justify-end p-6 sm:p-10 lg:p-14">
              <div className="max-w-3xl">
                {/* Category + Meter */}
                <div className="flex items-center gap-3 mb-3">
                  {article.categories?.[0] && (
                    <CategoryPill label={article.categories[0]} />
                  )}
                  <CorroborationMeter sourceCount={sourceCount} size="sm" showLabel={false} />
                </div>

                {/* Headline */}
                <h2 className={`text-display-xl font-display text-white mb-3 line-clamp-3 drop-shadow-lg transition-all duration-700 ${isTransitioning ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'}`}>
                  {article.title}
                </h2>

                {/* Excerpt */}
                {article.excerpt && (
                  <p className={`text-white/70 text-body-md max-w-xl line-clamp-2 mb-4 transition-all duration-700 delay-75 ${isTransitioning ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'}`}
                     style={{ fontFamily: 'var(--font-display), ui-serif, serif' }}>
                    {article.excerpt}
                  </p>
                )}

                {/* Metadata */}
                <div className={`flex items-center gap-3 text-white/60 transition-all duration-700 delay-150 ${isTransitioning ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'}`}>
                  <span className="font-data text-[11px] font-semibold">
                    {formatDistanceToNow(dateObj, { addSuffix: true })}
                  </span>
                  <span className="w-1 h-1 bg-white/30 rounded-full" />
                  <span className="font-data text-[11px]">
                    {article.source.name}
                    {sourceCount > 1 ? ` + ${sourceCount - 1}` : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Slide indicators */}
      {articles.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {articles.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className={`h-1 rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? 'w-6 bg-[var(--verified-teal)]'
                  : 'w-2 bg-[var(--border)] hover:bg-[var(--foreground-muted)]'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
