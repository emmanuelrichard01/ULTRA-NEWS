"use client";

import { useEffect, useId, useRef, useState } from 'react';

import { CheckIcon, DownloadIcon, LinkIcon, ShareIcon } from './icons';
import { SHARE_TARGETS, shareHref, shareText, taggedUrl, type SharePayload } from '@/lib/share';

/**
 * Share — one control, the platform's own sheet first.
 *
 * On a phone, the system share sheet already lists the reader's apps, their
 * recent contacts and AirDrop; nothing we draw can beat it, so a tap goes
 * straight there. On desktop, where that sheet is thin or absent, a small
 * menu offers copy-link, the networks news actually travels on, and the
 * story's card as an image for platforms that take pictures, not links.
 *
 * No network's SDK is loaded — every option is a plain link (see lib/share).
 */

interface ShareMenuProps {
  /** Path of the page to share, e.g. /story/slug. Resolved against the origin at click time. */
  path: string;
  title: string;
  evidence?: string;
  /** Path of the page's generated card, offered as "Download card". */
  cardPath?: string;
  /** Visual form of the trigger. */
  variant?: 'pill' | 'solid' | 'compact';
  label?: string;
  className?: string;
  /** Which way the menu opens from the trigger. */
  align?: 'left' | 'right';
  /** For triggers inside a bar that hides itself. */
  tabIndex?: number;
}

export default function ShareMenu({
  path,
  title,
  evidence,
  cardPath,
  variant = 'pill',
  label = 'Share',
  className = '',
  align = 'right',
  tabIndex,
}: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const payload = (): SharePayload => ({
    url: new URL(path, window.location.origin).toString(),
    title,
    evidence,
  });

  // Dismiss on Escape or a click outside; focus the first item on open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    const t = setTimeout(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      clearTimeout(t);
    };
  }, [open]);

  const onTrigger = async () => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (coarse && typeof navigator.share === 'function') {
      const p = payload();
      try {
        await navigator.share({ title: p.title, text: shareText(p), url: taggedUrl(p.url, 'native') });
        return;
      } catch (err) {
        // Dismissing the sheet is not an error; anything else falls back to the menu.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    setOpen((v) => !v);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(taggedUrl(payload().url, 'copy'));
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1200);
    } catch {
      // Clipboard blocked — the menu stays open with the network links.
    }
  };

  const triggerClass =
    variant === 'solid'
      ? 'pill pill-solid'
      : variant === 'compact'
      ? 'flex h-8 items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 text-[12px] text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]'
      : 'pill pill-outline !py-2 text-[13px]';

  return (
    <span ref={wrapRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={onTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label ? undefined : 'Share this page'}
        tabIndex={tabIndex}
        className={triggerClass}
      >
        <ShareIcon size={14} />
        {label}
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Share"
          className={`animate-fade-in-up absolute top-full z-50 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-lg)] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {/* What will be shared — the evidence line leads, as it will in the feed. */}
          <div className="border-b border-[var(--border)] px-4 py-3">
            {evidence && <p className="text-[11px] font-medium text-[var(--accent)]">{evidence}</p>}
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[var(--foreground)]">{title}</p>
          </div>

          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={copy}
              className="flex w-full items-center gap-3 rounded-[var(--radius-chip)] px-3 py-2.5 text-left text-[14px] text-[var(--foreground)] transition-colors hover:bg-[var(--surface)] focus:bg-[var(--surface)] focus:outline-none"
            >
              {copied ? <CheckIcon size={15} className="text-[var(--verified-teal)]" /> : <LinkIcon size={15} />}
              {copied ? 'Link copied' : 'Copy link'}
            </button>
            {cardPath && (
              <a
                role="menuitem"
                href={cardPath}
                download={`ultra-news-${path.split('/').filter(Boolean).pop() || 'card'}.png`}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-3 rounded-[var(--radius-chip)] px-3 py-2.5 text-[14px] text-[var(--foreground)] transition-colors hover:bg-[var(--surface)] focus:bg-[var(--surface)] focus:outline-none"
              >
                <DownloadIcon size={15} />
                Download card
                <span className="ml-auto text-[11px] text-[var(--foreground-subtle)]">for Instagram</span>
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1 border-t border-[var(--border)] p-1.5">
            {SHARE_TARGETS.map((t) => (
              <a
                key={t.network}
                role="menuitem"
                href={shareHref(t.network, payload())}
                target={t.network === 'email' ? undefined : '_blank'}
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="rounded-[var(--radius-chip)] px-3 py-2 text-[13px] text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)] focus:bg-[var(--surface)] focus:text-[var(--foreground)] focus:outline-none"
              >
                {t.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}
