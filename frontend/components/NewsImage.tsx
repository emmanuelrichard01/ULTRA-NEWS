"use client";

import { useState } from 'react';

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
}

export default function NewsImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  priority = false,
  fallbackText = 'ULTRA',
}: NewsImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || failed) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[var(--surface-sunken)] select-none"
        aria-hidden="true"
      >
        <span className="font-display text-3xl font-semibold tracking-tight text-[var(--foreground-subtle)] opacity-30">
          {fallbackText}
        </span>
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
