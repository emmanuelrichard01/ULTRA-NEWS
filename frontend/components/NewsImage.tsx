"use client";

import { useEffect, useRef, useState } from 'react';

/**
 * Publisher image with a typographic fallback.
 *
 * Deliberately a plain <img> rather than next/image. Article images come from a
 * long tail of publisher CDNs that changes as the source registry does; routing
 * them through the optimizer means any host missing from the allowlist returns a
 * 400 and shows nothing. The alternative — allowing every remote host — turns the
 * deployment into an open image proxy, which is what the config used to do.
 *
 * So: native lazy loading, async decoding, and an explicit priority hint for the
 * one above-the-fold image. That recovers most of the LCP benefit without either
 * failure mode.
 */

interface NewsImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  /** Set on the single largest above-the-fold image; leave false elsewhere. */
  priority?: boolean;
  fallbackText?: string;
  /**
   * Outlets carrying the story. Turns a missing picture into the one thing
   * this product would rather show anyway — see the fallback below.
   */
  fallbackSources?: string[];
  /**
   * Suppress the typographic fallback, leaving only the surface colour.
   *
   * For callers that draw their own content over the frame. LeadHero overlays
   * a headline and the outlet names onto the image, so a centred "Reported by
   * Al Jazeera English" underneath collided with the headline sitting on top
   * of it — two pieces of text in the same rectangle saying the same thing.
   */
  showFallbackText?: boolean;
}

export default function NewsImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  priority = false,
  fallbackText = 'ULTRA',
  fallbackSources = [],
  showFallbackText = true,
}: NewsImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  /**
   * Catch images the browser already had cached.
   *
   * A cached image can finish decoding before React attaches `onLoad`, so the
   * event never fires and the element would sit at `opacity-0` behind a
   * skeleton forever. Reading `complete` once on the next tick covers it.
   *
   * There is deliberately NO timeout here.
   *
   * A previous version gave up on an image after 6s (priority) or 10s (lazy)
   * and swapped in the fallback, reasoning that a host which stalls without
   * erroring would otherwise leave a placeholder up indefinitely. That shipped
   * and broke images across the whole site.
   *
   * The reason: feed images are `loading="lazy"`, so the browser defers the
   * request until they approach the viewport — but the timer started on MOUNT,
   * for every card on the page at once. The fifteenth card began a ten-second
   * countdown immediately, was never requested because the reader had not
   * scrolled to it, and was marked failed on a request that had not been made.
   * `failed` then unmounts the <img> entirely, so it could never recover. Above
   * the fold the same thing happened to anyone on a connection slower than a
   * local dev server.
   *
   * `onError` is the only correct signal for a broken image, and unlike a
   * timer it cannot be wrong. A genuinely stalled host now shows the skeleton,
   * which is honest: the image is still coming.
   */
  useEffect(() => {
    if (!src || loaded || failed) return;

    // Deferred rather than run in the effect body: setting state synchronously
    // there costs an extra render pass before paint, on a component that
    // appears once per feed row.
    const cachedCheck = setTimeout(() => {
      if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
        setLoaded(true);
      }
    }, 0);

    return () => clearTimeout(cachedCheck);
  }, [src, loaded, failed]);

  /**
   * Fallback.
   *
   * Publisher images come out of RSS and a meaningful share of them 404, hotlink-
   * block, or were never there — so this state is common, not exceptional, and on
   * a lead card it occupies several hundred pixels at the top of the front page.
   * A giant wordmark at 30% opacity is a hole with a logo in it; in dark mode,
   * against a near-black surface, it was very close to invisible.
   *
   * Where the outlets are known, they fill the space instead. A reader who came
   * for "who is reporting this" gets an answer rather than an apology, and the
   * frame stops looking broken.
   */
  if (!src || failed) {
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden bg-[var(--surface-sunken)] p-6 text-center select-none"
        aria-hidden="true"
      >
        {!showFallbackText ? null : fallbackSources.length > 0 ? (
          <>
            <span className="text-label text-[var(--foreground-subtle)]">
              Reported by
            </span>
            <span className="font-display text-balance text-[var(--foreground-muted)]">
              {fallbackSources.slice(0, 4).join(' · ')}
            </span>
          </>
        ) : (
          <span className="font-display text-2xl font-semibold tracking-tight text-[var(--foreground-subtle)] opacity-40">
            {fallbackText}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      {!loaded && <div className="skeleton absolute inset-0" aria-hidden="true" />}
      {/* eslint-disable-next-line @next/next/no-img-element -- deliberate; see
          the component docblock. Publisher CDNs are a long tail that changes
          with the source registry, and routing them through next/image means a
          400 and a blank frame for any host not in the allowlist. */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        // fetchPriority is a valid DOM attribute React forwards as-is.
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`${className} transition-opacity duration-500 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </>
  );
}
