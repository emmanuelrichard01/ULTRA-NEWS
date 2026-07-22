"use client";

import { useState } from 'react';
import type { StoryDetailFull } from '@/lib/types';

export default function ExportBriefButton({ story }: { story: StoryDetailFull }) {
  const [copied, setCopied] = useState(false);

  const handleExport = () => {
    const outlets = Array.from(new Set(story.articles.map(a => a.source.name)));
    const text = `# ULTRA-NEWS Intelligence Brief: ${story.title}

**Status:** ${story.status.toUpperCase()} (${story.independent_count} independent domains, ${story.articles.length} reports)
**First Reported:** ${new Date(story.first_seen_at).toUTCString()}
**Categories:** ${story.categories.join(', ') || 'General'}

## Executive Summary
${story.summary || 'No AI summary available.'}

## Reporting Outlets
${outlets.map(o => `- ${o}`).join('\n')}

## Chronological Framing Timeline
${story.articles.map((a, i) => `${i + 1}. [${a.source.name}] "${a.title}" — ${a.url}`).join('\n')}

---
Generated via ULTRA-NEWS Wire Room Intelligence Platform
`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-2 font-data text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-chip)] bg-[var(--surface-elevated)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--foreground)] transition-all"
      title="Copy Markdown Intelligence Brief"
    >
      {copied ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--verified-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span className="text-[var(--verified-teal)]">Brief Copied!</span>
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          <span>Export Brief</span>
        </>
      )}
    </button>
  );
}
