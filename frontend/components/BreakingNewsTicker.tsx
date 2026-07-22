"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface TickerStory {
  id: number;
  title: string;
  slug: string;
  status: string;
  first_seen_at: string;
}

export default function BreakingNewsTicker() {
  const [stories, setStories] = useState<TickerStory[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Only connect in browser
    if (typeof window === "undefined") return;

    // Use absolute URL if needed, or relative if handled by Next.js rewrites
    const sseBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const eventSource = new EventSource(`${sseBase}/api/v1/stream`);

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.addEventListener("new_story", (event) => {
      try {
        const data = JSON.parse(event.data);
        setStories((prev) => {
          // Keep only the last 10 breaking/developing stories in the ticker
          const updated = [data, ...prev];
          // Remove duplicates
          const unique = Array.from(new Map(updated.map((item) => [item.id, item])).values());
          return unique.slice(0, 10);
        });
      } catch (err) {
        console.error("Failed to parse SSE data", err);
      }
    });

    eventSource.onerror = () => {
      setIsConnected(false);
      // EventSource will automatically try to reconnect
    };

    return () => {
      eventSource.close();
    };
  }, []);

  if (stories.length === 0) return null;

  return (
    <div className="w-full bg-[var(--surface-elevated)] border-b border-[var(--border)] overflow-hidden flex items-center h-10 px-4">
      <div className="flex-shrink-0 flex items-center gap-2 pr-4 border-r border-[var(--border)] font-data text-[10px] font-bold uppercase tracking-widest text-[var(--signal-amber)]">
        <span className="relative flex h-2 w-2">
          {isConnected && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--signal-amber)] opacity-75"></span>
          )}
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--signal-amber)]"></span>
        </span>
        Wire Alert
      </div>
      
      <div className="flex-grow overflow-hidden relative ml-4">
        {/* CSS Marquee */}
        <div className="animate-marquee whitespace-nowrap flex items-center gap-12">
          {stories.map((story) => (
            <Link
              key={story.id}
              href={`/story/${story.slug}`}
              className="inline-flex items-center gap-3 hover:text-[var(--primary)] transition-colors"
            >
              <span className="font-data text-[10px] text-[var(--foreground-muted)]">
                {formatDistanceToNow(new Date(story.first_seen_at), { addSuffix: true })}
              </span>
              <span className="font-display text-sm font-semibold text-[var(--foreground)]">
                {story.title}
              </span>
            </Link>
          ))}
          {/* Duplicate for seamless looping if we have enough stories */}
          {stories.length > 3 && stories.map((story) => (
            <Link
              key={`dup-${story.id}`}
              href={`/story/${story.slug}`}
              className="inline-flex items-center gap-3 hover:text-[var(--primary)] transition-colors"
            >
              <span className="font-data text-[10px] text-[var(--foreground-muted)]">
                {formatDistanceToNow(new Date(story.first_seen_at), { addSuffix: true })}
              </span>
              <span className="font-display text-sm font-semibold text-[var(--foreground)]">
                {story.title}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
