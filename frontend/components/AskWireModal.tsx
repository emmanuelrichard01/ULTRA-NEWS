"use client";

import { useState, useEffect, useRef } from 'react';

interface AskResponse {
  answer: string;
  context_sources: string[];
  synthesis_type: string;
}

export default function AskWireModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResponse(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    try {
      const res = await fetch(`${apiBase}/api/v1/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) {
        throw new Error(`Failed to consult the wire room (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No readable stream');
      const decoder = new TextDecoder('utf-8');

      let currentResponse: AskResponse = { answer: '', context_sources: [], synthesis_type: 'extractive' };
      setResponse(currentResponse);
      setLoading(false);

      let done = false;
      let buffer = '';
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr === '[DONE]') {
                done = true;
                break;
              }
              if (dataStr) {
                try {
                  const data = JSON.parse(dataStr);
                  if (data.type === 'metadata') {
                    currentResponse = { ...currentResponse, context_sources: data.context_sources, synthesis_type: data.synthesis_type };
                    setResponse({ ...currentResponse });
                  } else if (data.type === 'chunk') {
                    currentResponse = { ...currentResponse, answer: currentResponse.answer + data.text };
                    setResponse({ ...currentResponse });
                  } else if (data.type === 'error') {
                    currentResponse = { ...currentResponse, answer: currentResponse.answer + data.text };
                    setResponse({ ...currentResponse });
                  }
                } catch (e) {
                  // Ignore incomplete JSON chunks (though split by \n should prevent this for SSE)
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while synthesizing intelligence.');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-card)] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-elevated)]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--verified-teal)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--verified-teal)]"></span>
            </span>
            <span className="font-data text-xs font-bold uppercase tracking-widest text-[var(--verified-teal)]">
              Ask The Wire Room RAG Intelligence
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Form Input */}
        <form onSubmit={handleSubmit} className="p-6 border-b border-[var(--border)]">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about current stories... e.g. What is the latest on inflation?"
              maxLength={200}
              className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[var(--verified-teal)] text-[var(--foreground)] text-sm rounded-[var(--radius-card)] px-4 py-3 pr-24 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-2 font-data text-xs font-bold uppercase tracking-wider bg-[var(--accent)] text-white px-4 py-2 rounded-[var(--radius-chip)] disabled:opacity-40 transition-all hover:brightness-110"
            >
              {loading ? 'Synthesizing...' : 'Ask Wire'}
            </button>
          </div>
        </form>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading && (
            <div className="py-12 text-center space-y-3">
              <div className="inline-block w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <p className="font-data text-xs text-[var(--foreground-muted)]">
                Querying pgvector embeddings & synthesizing multi-source context...
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-[var(--radius-card)] bg-[var(--wire-red)]/10 border border-[var(--wire-red)]/30 text-[var(--wire-red)] font-data text-xs">
              {error}
            </div>
          )}

          {response && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)]">
                  Synthesized Wire Brief ({response.synthesis_type} mode)
                </span>
              </div>

              <div className="text-body-md text-[var(--foreground)] space-y-3 font-serif whitespace-pre-wrap leading-relaxed">
                {response.answer}
              </div>

              {response.context_sources.length > 0 && (
                <div className="pt-4 border-t border-[var(--border)]">
                  <span className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] block mb-2">
                    Triangulated Sources ({response.context_sources.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {response.context_sources.map((src) => (
                      <span key={src} className="font-data text-[10px] bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--foreground-muted)] px-2 py-1 rounded-sm">
                        {src}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && !response && !error && (
            <div className="py-8 text-center text-[var(--foreground-muted)]">
              <p className="font-display text-lg mb-1 text-[var(--foreground)]">Direct Semantic Access</p>
              <p className="font-data text-xs opacity-70">
                Ask questions across 1,000+ indexed news articles and 35 real-time feeds.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
