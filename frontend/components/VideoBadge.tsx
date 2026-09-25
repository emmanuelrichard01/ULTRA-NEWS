import { PlayIcon } from './icons';

/**
 * "Has video" — the badge, in three forms.
 *
 * Ultra News does not play or re-host publisher video: it links to reporting,
 * it does not republish it. The badge says video exists and, where it links,
 * sends the reader to the publisher's own page and player.
 *
 *   overlay  frosted, for cards whose headline sits on a photograph
 *   inline   quiet text + glyph, for meta rows
 *   count    "Video from 3 outlets", for a story's own page
 */
export default function VideoBadge({
  outlets = 1,
  variant = 'inline',
  className = '',
}: {
  outlets?: number;
  variant?: 'overlay' | 'inline' | 'count';
  className?: string;
}) {
  if (outlets <= 0) return null;

  if (variant === 'overlay') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-white backdrop-blur-md ${className}`}
        title={outlets === 1 ? 'An outlet has video of this story' : `${outlets} outlets have video of this story`}
      >
        <PlayIcon size={9} />
        Video
      </span>
    );
  }

  if (variant === 'count') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[13px] text-[var(--foreground-muted)] ${className}`}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--inverse)] text-[var(--inverse-foreground)]">
          <PlayIcon size={8} />
        </span>
        Video from {outlets} {outlets === 1 ? 'outlet' : 'outlets'}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium text-[var(--foreground-muted)] ${className}`}
      title={outlets === 1 ? 'An outlet has video of this story' : `${outlets} outlets have video of this story`}
    >
      <PlayIcon size={9} />
      Video
    </span>
  );
}
