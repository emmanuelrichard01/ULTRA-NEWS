"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Listen — read text aloud with the browser's own speech synthesis.
 *
 * No audio files, no TTS vendor, nothing leaves the device. The text passed
 * in is the text on the page, caveats included.
 *
 * Read as a queue of sentences, not one utterance, because of two Chrome
 * defects that made the first version silently fail:
 *
 *   - Chrome's online voices stop partway through a long utterance with no
 *     event at all — a brief is far past the limit. Short utterances never
 *     reach it.
 *   - speak() in the same tick as cancel() is sometimes dropped. The queue
 *     starts on the next tick after a cancel.
 *
 * Sentence boundaries also give honest progress (sentence n of m), where
 * `onboundary` fires inconsistently across engines and voices.
 */

const subscribe = () => () => {};
const hasSpeech = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Prefer a natural-sounding English voice when the platform offers one. */
function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => /en[-_](GB|US)/i.test(v.lang) && /natural|neural|premium|enhanced/i.test(v.name)) ??
    voices.find((v) => /en[-_](GB|US)/i.test(v.lang) && v.localService) ??
    voices.find((v) => v.lang.startsWith('en'))
  );
}

/** Sentences, with long ones split at a comma or space so none runs past ~220 chars. */
export function toChunks(text: string): string[] {
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) ?? [];
  const chunks: string[] = [];
  for (const raw of sentences) {
    let s = raw.trim();
    while (s.length > 220) {
      const cut = Math.max(s.lastIndexOf(', ', 220), s.lastIndexOf(' ', 220));
      const at = cut > 80 ? cut + 1 : 220;
      chunks.push(s.slice(0, at).trim());
      s = s.slice(at).trim();
    }
    if (s) chunks.push(s);
  }
  return chunks;
}

export default function ListenButton({
  text,
  label = 'Listen',
  className = '',
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const supported = useSyncExternalStore(subscribe, hasSpeech, () => false);
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [progress, setProgress] = useState(0);
  // Incremented on every start/stop, so callbacks from an abandoned run
  // (cancel() fires onend/onerror on the utterance it kills) are ignored.
  const runRef = useRef(0);

  useEffect(() => {
    if (!hasSpeech()) return;
    // Voices load asynchronously in Chrome; touching the list starts that.
    window.speechSynthesis.getVoices();
    return () => {
      // The LATEST run counter is the point: bumping it invalidates any queued
      // sentence callbacks from the run that is being torn down.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      runRef.current++;
      window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported || !text.trim()) return null;

  const stop = () => {
    runRef.current++;
    window.speechSynthesis.cancel();
    setState('idle');
    setProgress(0);
  };

  const start = () => {
    const synth = window.speechSynthesis;
    const chunks = toChunks(text);
    if (chunks.length === 0) return;
    const run = ++runRef.current;
    synth.cancel();
    const voice = pickVoice();

    const speakAt = (i: number) => {
      if (run !== runRef.current) return;
      if (i >= chunks.length) {
        setState('idle');
        setProgress(0);
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[i]);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? 'en-GB';
      u.rate = 1.02;
      u.onend = () => {
        if (run !== runRef.current) return;
        setProgress((i + 1) / chunks.length);
        speakAt(i + 1);
      };
      u.onerror = (e) => {
        // "interrupted"/"canceled" are our own stop(); anything else ends the run.
        if (run !== runRef.current || e.error === 'interrupted' || e.error === 'canceled') return;
        setState('idle');
        setProgress(0);
      };
      synth.speak(u);
    };

    setState('playing');
    setProgress(0);
    // Next tick, not now: speak() straight after cancel() is dropped by Chrome.
    setTimeout(() => speakAt(0), 60);
  };

  const toggle = () => {
    const synth = window.speechSynthesis;
    if (state === 'idle') start();
    else if (state === 'playing') {
      synth.pause();
      setState('paused');
    } else {
      synth.resume();
      setState('playing');
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={state === 'playing'}
        className="pill pill-outline group relative overflow-hidden !py-2 text-[13px]"
      >
        {/* Progress fills the pill from the left, sentence by sentence. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-[var(--accent)]/10 transition-[width] duration-500"
          style={{ width: `${progress * 100}%` }}
        />
        <span className="relative flex items-center gap-2">
          {state === 'playing' ? (
            <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-[2.5px] origin-bottom rounded-full bg-[var(--accent)] motion-safe:animate-[eq_900ms_ease-in-out_infinite]"
                  style={{ height: '100%', animationDelay: `${i * 150}ms` }}
                />
              ))}
            </span>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          {state === 'idle' ? label : state === 'playing' ? 'Pause' : 'Resume'}
        </span>
      </button>
      {state !== 'idle' && (
        <button
          type="button"
          onClick={stop}
          aria-label="Stop reading"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="5" y="5" width="14" height="14" rx="2" />
          </svg>
        </button>
      )}
    </span>
  );
}
