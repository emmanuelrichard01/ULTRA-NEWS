"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import AskWireModal from './AskWireModal';

/**
 * AskProvider — one Ask dialog, reachable from anywhere.
 *
 * The modal and its ⌘K handler used to live inside FeedPage. FeedPage renders
 * on four routes; the site has a dozen. So on a story page — the page a reader
 * lands on from the feed, and the one where a question is most likely to occur
 * to them — there was no Ask button, and ⌘K did nothing at all. The same on
 * /about, /rss, /article and every topic that is not a feed. The product's one
 * generative feature was missing from most of the product, and the keyboard
 * shortcut advertised on the button silently failed on the majority of pages.
 *
 * Lifting it to the layout also collapses a duplication that was about to
 * happen: the header needs an Ask control and the feed masthead already has
 * one. Two components owning two `isOpen` booleans and two `keydown` listeners
 * would mean two modals in the tree, both listening for ⌘K, and whichever
 * mounted last winning. One provider, one dialog, one listener.
 */

interface AskContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const AskContext = createContext<AskContextValue | null>(null);

export function useAsk(): AskContextValue {
  const ctx = useContext(AskContext);
  if (!ctx) {
    throw new Error('useAsk must be used inside <AskProvider>');
  }
  return ctx;
}

export function AskProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <AskContext.Provider value={value}>
      {children}
      <AskWireModal isOpen={isOpen} onClose={close} />
    </AskContext.Provider>
  );
}
