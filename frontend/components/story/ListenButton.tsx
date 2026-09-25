"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Listen to the brief.
 *
 * Uses the browser's own speech synthesis — no audio files, no TTS vendor, no
 * cost per listen, and nothing leaves the device. A reader on a commute, or
 * one who simply takes information in better by ear, gets the brief read out
 * with its caveats intact: the text passed in is the same text on the page,
 * including "one outlet reports…" where the brief says it.
 *
 * Absent entirely where the API is missing, rather than a button that does
 * nothing. Speech is cancelled on unmount, so navigating away stops it.
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
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => () => {
    if (hasSpeech()) window.speechSynthesis.cancel();
  }, []);

  if (!supported || !text.trim()) return null;

  const start = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.rate = 1.02;
    u.onboundary = (e) => setProgress(Math.min(1, e.charIndex / text.length));
    u.onend = () => {
      setState('idle');
      setProgress(0);
    };
    u.onerror = () => {
      setState('idle');
      setProgress(0);
    };
    utterance.current = u;
    synth.speak(u);
    setState('playing');
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

  const stop = () => {
    window.speechSynthesis.cancel();
    setState('idle');
    setProgress(0);
  };

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={state === 'playing'}
        className="pill pill-outline group relative overflow-hidden !py-2 text-[13px]"
      >
        {/* Progress fills the pill from the left as the brief is read. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-[var(--accent)]/10 transition-[width] duration-300"
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
