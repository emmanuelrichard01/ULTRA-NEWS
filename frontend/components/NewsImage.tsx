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
   * Give up on a slow image.
   *
   * `onError` covers a host that refuses or 404s, but not one that accepts the
   * connection and never finishes — hotlink protection that stalls, a CDN that
   * is simply far away, a publisher having a bad day. In those cases the
   * element neither loads nor errors, so the placeholder sits there
   * indefinitely. On a lead card that is several hundred pixels of empty box at
   * the top of the front page, which reads as a broken layout rather than a
   * slow one.
   *
   * After the timeout the informative fallback below takes over, which on this
   * product is a reasonable thing to be looking at anyway.
   *
   * The `complete` check covers images the browser already had cached: those
   * can finish before React attaches its handlers, so `onLoad` never fires and
   * a picture that was ready instantly would otherwise be timed out.
   */
  useEffect(() => {
    if (!src || loaded || failed) return;

    // Both checks are deferred rather than run in the effect body: setting
    // state synchronously there costs an extra render pass before paint, on a
    // component that appears once per feed row.
    const cachedCheck = setTimeout(() => {
      if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
        setLoaded(true);
      }
    }, 0);

    const giveUp = setTimeout(() => setFailed(true), priority ? 6000 : 10000);

    return () => {
      clearTimeout(cachedCheck);
      clearTimeout(giveUp);
    };
  }, [src, loaded, failed, priority]);

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
