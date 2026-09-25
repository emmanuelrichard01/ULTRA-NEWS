"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Ask by voice.
 *
 * On a phone, typing a question into a news app is the slowest part of asking
 * it. This uses the browser's own speech recognition — no audio is sent to
 * Ultra News — and fills the box as you speak, so the reader sees the words
 * land and can correct them before sending. On a final result it submits.
 *
 * Rendered only where the API exists (Chrome, Edge, Safari; not Firefox), so
 * no reader is offered a button that does nothing. The browser vendor may
 * process the audio, which the button's label says.
 */

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => Recognition) | null;
}

const subscribe = () => () => {};

/**
 * What each recognition error means to the reader. These used to be swallowed:
 * the button flickered on and off and nothing said why — which is exactly how
 * a site-wide `microphone=()` permissions policy went unnoticed.
 */
const ERROR_HINTS: Record<string, string> = {
  'not-allowed': 'Microphone blocked — allow it in your browser’s site settings.',
  'service-not-allowed': 'Voice input is turned off in this browser.',
  'audio-capture': 'No microphone found.',
  'no-speech': 'Didn’t catch that — tap and try again.',
  network: 'Voice input needs a connection.',
  'language-not-supported': 'Voice input isn’t available for your language.',
};

export default function VoiceInput({
  onTranscript,
  onFinal,
  className = '',
}: {
  /** Called with the running transcript as words arrive. */
  onTranscript: (text: string) => void;
  /** Called once with the final transcript. */
  onFinal: (text: string) => void;
  className?: string;
}) {
  const supported = useSyncExternalStore(subscribe, () => recognitionCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      recRef.current?.abort();
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    []
  );

  const showHint = (text: string) => {
    setHint(text);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 4500);
  };

  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    let failed = false;
    setHint(null);
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onTranscript((finalText + interim).trim());
    };
    rec.onend = () => {
      setListening(false);
      if (!failed && finalText.trim()) onFinal(finalText.trim());
    };
    rec.onerror = (e) => {
      failed = true;
      setListening(false);
      // "aborted" is our own stop on unmount; everything else is explained.
      if (e.error !== 'aborted') showHint(ERROR_HINTS[e.error] ?? 'Voice input stopped — try again.');
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      showHint('Voice input could not start — try again.');
    }
  };

  return (
    <span className="relative inline-flex">
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      aria-label={listening ? 'Stop listening' : 'Ask by voice (your browser processes the audio)'}
      title={listening ? 'Stop listening' : 'Ask by voice'}
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
        listening
          ? 'bg-[var(--wire-red)] text-white'
          : 'text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]'
      } ${className}`}
    >
      {listening && <span aria-hidden="true" className="absolute inset-0 rounded-full bg-[var(--wire-red)] motion-safe:animate-ping opacity-30" />}
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="relative">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
    {hint && (
      <span
        role="status"
        className="animate-fade-in-up absolute right-0 top-full z-10 mt-2 w-56 rounded-[var(--radius-chip)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-[12px] leading-snug text-[var(--foreground)] shadow-[var(--shadow-md)]"
      >
        {hint}
      </span>
    )}
    </span>
  );
}
