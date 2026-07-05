"use client";

import Link from 'next/link';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import CorroborationMeter from './CorroborationMeter';
import CategoryPill from './CategoryPill';

/**
 * StoryCard — V3 Primary Feed Component
 *
 * Replaces FeedItem. Story-centric (clusters), not article-centric.
 * Features:
 * - Fanned stack when source_count > 1
 * - Corroboration meter (amber/teal)
 * - Fraunces headline, mono metadata
 * - Hero variant for featured stories
 */

interface StoryCardProps {
  title: string;
  slug: string;
  imageUrl?: string | null;
  excerpt?: string;
  publishedDate: string | Date;
  sourceCount: number;
  status: string;
  sources?: string[];
  categories?: string[];
  variant?: "standard" | "hero";
  storySlug?: string;
}

export default function StoryCard({
  title,
  slug,
  imageUrl,
  excerpt,
  publishedDate,
  sourceCount,
  status,
  sources = [],
  categories = [],
  variant = "standard",
  storySlug,
}: StoryCardProps) {
  const dateObj = typeof publishedDate === 'string' ? new Date(publishedDate) : publishedDate;
  const link = storySlug ? `/story/${storySlug}` : `/article/${slug}`;
  const [imgError, setImgError] = useState(false);
  const showStack = sourceCount > 1;

  if (variant === "hero") {
    return (
      <article className="group relative mb-8">
        {/* Fanned Stack (multi-source visual) */}
        <div className={showStack ? "fanned-stack" : ""}>
          <Link href={link} className="block">
            {/* Image — cinematic aspect ratio */}
            <div className="relative aspect-[16/9] sm:aspect-[2/1] lg:aspect-[21/9] w-full overflow-hidden rounded-[var(--radius-card)] mb-6 bg-[var(--surface-elevated)]">
              {imageUrl && !imgError ? (
                <img
                  src={imageUrl}
                  alt={title}
                  onError={() => setImgError(true)}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out will-change-transform"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[var(--border)] text-9xl font-display font-bold opacity-10">
                    U
                  </span>
                </div>
              )}
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

              {/* Overlay content */}
              <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 sm:p-10">
                <div className="max-w-3xl">
                  {/* Category + Meter */}
                  <div className="flex items-center gap-3 mb-3">
                    {categories[0] && (
                      <CategoryPill label={categories[0]} />
                    )}
                    <CorroborationMeter
                      sourceCount={sourceCount}
                      size="sm"
                      showLabel={false}
                    />
                  </div>

                  {/* Headline — Fraunces */}
                  <h2 className="text-display-xl font-display text-white mb-3 line-clamp-3 drop-shadow-md">
                    {title}
                  </h2>

                  {/* Mono metadata */}
                  <div className="flex items-center gap-3 text-white/80">
                    <span className="font-data text-xs font-semibold">
                      {formatDistanceToNow(dateObj, { addSuffix: true })}
                    </span>
                    {sources.length > 0 && (
                      <>
                        <span className="w-1 h-1 bg-white/40 rounded-full" />
                        <span className="font-data text-xs">
                          {sources[0]}{sources.length > 1 ? ` + ${sources.length - 1}` : ""}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </article>
    );
  }

  // Standard variant — list-style card
  return (
    <article className="group py-5 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-elevated)] transition-colors duration-150 -mx-4 px-4 rounded-[var(--radius-card)]">
      <Link href={link} className="flex flex-row-reverse sm:flex-row gap-5 items-start">
        {/* Image Thumbnail */}
        <div className={`flex-shrink-0 w-24 h-24 sm:w-36 sm:h-24 relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface-elevated)] ${showStack ? "fanned-stack" : ""}`}>
          {imageUrl && !imgError ? (
            <img
              src={imageUrl}
              alt=""
              onError={() => setImgError(true)}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 will-change-transform"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-[var(--border)]">U</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between h-24">
          <div>
            {/* Meta top — category + sources */}
            <div className="flex items-center gap-2 mb-1.5">
              {categories[0] && (
                <span className="font-data text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                  {categories[0]}
                </span>
              )}
              <span className="font-data text-[10px] text-[var(--foreground-muted)]">
                {formatDistanceToNow(dateObj, { addSuffix: true })}
              </span>
            </div>

            {/* Headline — Fraunces */}
            <h3 className="text-[17px] sm:text-[20px] font-display text-[var(--foreground)] leading-[1.25] group-hover:text-[var(--accent)] transition-colors tracking-tight line-clamp-2">
              {title}
            </h3>
          </div>

          {/* Bottom: corroboration meter + source names */}
          <div className="flex items-center gap-3 mt-1">
            <CorroborationMeter sourceCount={sourceCount} size="sm" showLabel={false} />
            {sources.length > 0 && (
              <span className="font-data text-[10px] text-[var(--foreground-muted)] truncate">
                {sources.slice(0, 3).join(" · ")}
                {sources.length > 3 ? ` +${sources.length - 3}` : ""}
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
