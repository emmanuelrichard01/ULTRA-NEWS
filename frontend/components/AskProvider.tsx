"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import AskFab from './AskFab';
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

/**
 * What a caller can hand the dialog when opening it.
 *
 *   query  asked immediately — a suggestion chip, a "what's the latest on…"
 *          link. Opening with a question and making the reader press Ask again
 *          would be a confirmation step for something they already chose.
 *   story  scopes the question to one story ("Ask about this story"). The
 *          backend then grounds the answer in that story's whole cluster first.
 */
export interface AskOptions {
  query?: string;
  story?: { slug: string; title: string };
}

export interface AskRequest {
  id: number;
  options: AskOptions;
}

interface AskContextValue {
  open: (options?: AskOptions) => void;
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
  // Bumped on every open, so re-opening with the same options still re-runs.
  const [request, setRequest] = useState<AskRequest>({ id: 0, options: {} });

  const open = useCallback((options: AskOptions = {}) => {
    setRequest((r) => ({ id: r.id + 1, options }));
    setIsOpen(true);
  }, []);
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
      <AskWireModal isOpen={isOpen} onClose={close} request={request} />
      <AskFab onOpen={() => open()} hidden={isOpen} />
    </AskContext.Provider>
  );
}
