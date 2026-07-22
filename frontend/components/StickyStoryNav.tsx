"use client";

import { useEffect, useState } from "react";
import CorroborationMeter from "./CorroborationMeter";

interface StickyStoryNavProps {
  title: string;
  sourceCount: number;
  isVerified: boolean;
  isDeveloping: boolean;
  shareUrl: string;
}

export default function StickyStoryNav({
  title,
  sourceCount,
  isVerified,
  isDeveloping,
  shareUrl,
}: StickyStoryNavProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show sticky nav after scrolling past the main header (roughly 300px)
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          url: shareUrl,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert("Link copied to clipboard!");
    }
  };

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-40 transition-transform duration-500 ease-in-out ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="bg-[var(--surface-elevated)]/80 backdrop-blur-md border-b border-[var(--border)] shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <h2 className="font-display text-[15px] font-bold text-[var(--foreground)] truncate">
              {title}
            </h2>
            
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
              <div className="h-4 w-px bg-[var(--border)] mx-1" />
              <CorroborationMeter sourceCount={sourceCount} size="sm" showLabel={false} />
              
              {isVerified && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-[var(--verified-teal)]/20 text-[8px] font-bold uppercase tracking-wider text-[var(--verified-teal)]">
                  Verified
                </span>
              )}
              {isDeveloping && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-[var(--signal-amber)]/20 text-[8px] font-bold uppercase tracking-wider text-[var(--signal-amber)]">
                  Developing
                </span>
              )}
            </div>
          </div>
          
          <button
            onClick={handleShare}
            className="flex-shrink-0 flex items-center gap-1.5 font-data text-[10px] font-bold uppercase tracking-wider text-[var(--foreground)] bg-[var(--background)] border border-[var(--border)] px-3 py-1.5 rounded-[var(--radius-chip)] hover:bg-[var(--surface-elevated)] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
