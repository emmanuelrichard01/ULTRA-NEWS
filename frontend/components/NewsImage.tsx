"use client";

import { useState } from 'react';

interface NewsImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  aspectRatio?: string;
  fallbackText?: string;
}

export default function NewsImage({
  src,
  alt,
  className = "w-full h-full object-cover",
  fallbackText = "ULTRA",
}: NewsImageProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || error) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--border)] flex items-center justify-center select-none overflow-hidden">
        <span className="font-display font-bold text-4xl text-[var(--foreground-muted)] opacity-20 tracking-widest">
          {fallbackText}
        </span>
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 bg-[var(--surface-elevated)] animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`${className} transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  );
}
