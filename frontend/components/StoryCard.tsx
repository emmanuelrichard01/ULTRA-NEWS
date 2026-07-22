"use client";

import Link from 'next/link';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import CorroborationMeter from './CorroborationMeter';
import CategoryPill from './CategoryPill';
import NewsImage from './NewsImage';

/**
 * StoryCard — V3.2 Primary Feed Component
 *
 * Features:
 * - Interactive Headline Matrix (Framing Switcher)
 * - Velocity Sparkline Heat Indicator
 * - Depth Mapping (Stacked paper effect) for corroborated stories
 * - Per-category color pills & Verified badges
 * - Fraunces headline, mono metadata
 */

interface StoryCardProps {
  title: string;
  slug: string;
  imageUrl?: string | null;
  excerpt?: string;
  publishedDate: string | Date;
  sourceCount: number;
  independentCount?: number;
  status: string;
  sources?: string[];
  categories?: string[];
  framingPreview?: { source: string; title: string; url: string }[];
  velocityScore?: number;
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
  independentCount,
  status,
  sources = [],
  categories = [],
  framingPreview = [],
  velocityScore = 0,
  variant = "standard",
  storySlug,
}: StoryCardProps) {
  const dateObj = typeof publishedDate === 'string' ? new Date(publishedDate) : publishedDate;
  const link = storySlug ? `/story/${storySlug}` : `/article/${slug}`;
  const meterCount = independentCount ?? sourceCount;
  const isVerified = status === 'corroborated';
  const isDeveloping = status === 'developing';
  
  // Depth mapping based on independent source count
  const depthClass = isVerified ? "shadow-[4px_4px_0px_0px_var(--border)] sm:shadow-[6px_6px_0px_0px_var(--border)] border border-[var(--border)] -translate-x-[2px] -translate-y-[2px]" 
                   : isDeveloping ? "shadow-[2px_2px_0px_0px_var(--border)] sm:shadow-[3px_3px_0px_0px_var(--border)] border border-[var(--border)] -translate-x-[1px] -translate-y-[1px]" 
                   : "border-b border-[var(--border)]";

  // State for interactive headline matrix
  const [activeFrameIdx, setActiveFrameIdx] = useState<number | null>(null);
  const displayTitle = activeFrameIdx !== null && framingPreview[activeFrameIdx] 
    ? framingPreview[activeFrameIdx].title 
    : title;
  
  const displaySource = activeFrameIdx !== null && framingPreview[activeFrameIdx] 
    ? framingPreview[activeFrameIdx].source 
    : (sources.length > 0 ? sources[0] : "");

  // Velocity Sparkline visualizer (score 0.0 to 10.0+)
  const velocityNormalized = Math.min(Math.max(velocityScore / 10, 0.1), 1);
  const velocityColor = velocityScore > 5 ? 'bg-[var(--wire-red)]' : velocityScore > 2 ? 'bg-[var(--signal-amber)]' : 'bg-[var(--accent)]';

  if (variant === "hero") {
    return (
      <article className={`group relative mb-8 rounded-[var(--radius-card)] bg-[var(--surface-elevated)] transition-transform duration-200 ${depthClass}`}>
        <Link href={link} className="block relative aspect-[16/9] sm:aspect-[2/1] lg:aspect-[21/9] w-full overflow-hidden rounded-[calc(var(--radius-card)-1px)]">
          <NewsImage src={imageUrl} alt={title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out will-change-transform" />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          {/* Overlay content */}
          <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 sm:p-10">
            <div className="max-w-3xl">
              {/* Category + Meter + Verified badge */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {categories.slice(0, 2).map((cat) => (
                  <CategoryPill key={cat} label={cat} size="sm" />
                ))}
                <CorroborationMeter
                  sourceCount={meterCount}
                  size="sm"
                  showLabel={false}
                />
                {isVerified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[var(--verified-teal)] border border-[var(--verified-teal)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    <span className="font-data text-[9px] font-bold uppercase tracking-wider text-white">Verified</span>
                  </span>
                )}
                
                {/* Velocity Indicator */}
                {velocityScore > 1 && (
                  <div className="flex items-center gap-1.5 ml-2 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm" title={`Velocity: ${velocityScore.toFixed(1)}/hr`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    <div className="flex gap-0.5 h-2 w-8 items-end">
                      <div className={`w-full ${velocityColor} opacity-40`} style={{ height: '40%' }}></div>
                      <div className={`w-full ${velocityColor} opacity-70`} style={{ height: '70%' }}></div>
                      <div className={`w-full ${velocityColor}`} style={{ height: `${velocityNormalized * 100}%` }}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Headline Matrix Hover Area */}
              <div className="relative min-h-[100px]">
                <h2 className="text-display-xl font-display text-white mb-4 line-clamp-3 drop-shadow-lg leading-[1.1] transition-all duration-300">
                  {displayTitle}
                </h2>
              </div>

              {/* Framing Switcher (Interactive Tabs) */}
              {framingPreview.length > 1 && (
                <div className="flex flex-wrap gap-1 mb-4" onClick={(e) => e.preventDefault()}>
                  <span className="font-data text-[9px] text-white/60 uppercase tracking-widest mr-2 py-1">Framing:</span>
                  {framingPreview.map((frame, idx) => (
                    <button
                      key={idx}
                      onMouseEnter={() => setActiveFrameIdx(idx)}
                      onMouseLeave={() => setActiveFrameIdx(null)}
                      className={`font-data text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors ${
                        activeFrameIdx === idx 
                          ? 'bg-white text-black border-white' 
                          : 'bg-black/40 text-white/80 border-white/20 hover:border-white/50 hover:bg-black/60'
                      }`}
                    >
                      {frame.source}
                    </button>
                  ))}
                </div>
              )}

              {/* Mono metadata */}
              <div className="flex items-center gap-3 text-white/80 border-t border-white/20 pt-3 mt-1">
                <span className="font-data text-xs font-semibold">
                  {formatDistanceToNow(dateObj, { addSuffix: true })}
                </span>
                {displaySource && (
                  <>
                    <span className="w-1 h-1 bg-white/40 rounded-full" />
                    <span className="font-data text-xs flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8c-1.1 0-2 .9-2 2v18Z"/><path d="M2 18h2"/><path d="M2 14h2"/><path d="M2 10h2"/><path d="M2 6h2"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M12 16h.01"/><path d="M16 16h.01"/><path d="M12 8h.01"/><path d="M16 8h.01"/></svg>
                      {displaySource}
                      {activeFrameIdx === null && sources.length > 1 ? ` + ${sources.length - 1} outlets` : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </Link>
      </article>
    );
  }

  // Standard variant — Editorial list-style card
  return (
    <article className={`group relative py-6 hover:bg-[var(--surface-elevated)] transition-colors duration-200 -mx-4 px-4 rounded-[var(--radius-card)] ${depthClass}`}>
      <Link href={link} className="flex flex-row-reverse sm:flex-row gap-5 lg:gap-8 items-start">
        {/* Image Thumbnail */}
        <div className={`flex-shrink-0 w-28 h-28 sm:w-48 sm:h-32 relative overflow-hidden rounded-[calc(var(--radius-card)-2px)] bg-[var(--surface)]`}>
          <NewsImage src={imageUrl} alt={title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 will-change-transform" fallbackText="U" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between min-h-[112px] sm:min-h-[128px]">
          <div>
            {/* Meta top — categories + time + verified badge + sparkline */}
            <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
              {categories.slice(0, 2).map((cat) => (
                <CategoryPill key={cat} label={cat} size="xs" />
              ))}
              <span className="font-data text-[10px] text-[var(--foreground-muted)] uppercase tracking-wider">
                {formatDistanceToNow(dateObj, { addSuffix: true })}
              </span>
              
              {isVerified && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-[var(--verified-teal)]/15">
                  <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--verified-teal)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  <span className="font-data text-[8px] font-bold text-[var(--verified-teal)] tracking-wider">VERIFIED</span>
                </span>
              )}
              
              {velocityScore > 1 && (
                <span className="flex items-center gap-1 text-[var(--foreground-muted)] opacity-60 ml-auto sm:ml-2">
                   <div className="flex gap-[1px] h-2.5 w-6 items-end" title={`Velocity: ${velocityScore.toFixed(1)}/hr`}>
                    <div className={`w-full ${velocityColor} opacity-40`} style={{ height: '40%' }}></div>
                    <div className={`w-full ${velocityColor} opacity-70`} style={{ height: '70%' }}></div>
                    <div className={`w-full ${velocityColor}`} style={{ height: `${velocityNormalized * 100}%` }}></div>
                  </div>
                </span>
              )}
            </div>

            {/* Headline — Fraunces */}
            <h3 className="text-[18px] sm:text-[22px] font-display text-[var(--foreground)] leading-[1.2] group-hover:text-[var(--accent)] transition-colors tracking-tight line-clamp-3">
              {displayTitle}
            </h3>
          </div>

          {/* Bottom: Interactive Framing Switcher OR standard source list */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
            <div className="flex items-center gap-3" onClick={(e) => framingPreview.length > 1 && e.preventDefault()}>
              <CorroborationMeter sourceCount={meterCount} size="sm" showLabel={false} />
              
              {framingPreview.length > 1 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-data text-[9px] text-[var(--foreground-muted)] uppercase tracking-widest mr-1">Framing:</span>
                  {framingPreview.map((frame, idx) => (
                    <button
                      key={idx}
                      onMouseEnter={() => setActiveFrameIdx(idx)}
                      onMouseLeave={() => setActiveFrameIdx(null)}
                      className={`font-data text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border transition-colors ${
                        activeFrameIdx === idx 
                          ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]' 
                          : 'bg-transparent text-[var(--foreground-muted)] border-[var(--border)] hover:border-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {frame.source}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="font-data text-[10px] text-[var(--foreground-muted)] truncate max-w-[200px]">
                  {displaySource}
                </span>
              )}
            </div>
            
            {activeFrameIdx === null && !framingPreview.length && sources.length > 1 && (
               <span className="font-data text-[9px] text-[var(--foreground-muted)] uppercase tracking-wider shrink-0 bg-[var(--surface-elevated)] px-1.5 py-0.5 rounded-sm">
                 +{sources.length - 1} Outlets
               </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
