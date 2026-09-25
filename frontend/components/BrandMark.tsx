import Image from 'next/image';

/**
 * BrandMark — the logo lockup.
 *
 * The product shipped with two logo files in `public/images` that nothing
 * imported: the header and the footer each set the word "UltraNews" in Fraunces
 * and left it at that. So the brand existed as a duplicated string in two
 * components while the actual mark sat unused on disk.
 *
 * Both variants are square tiles carrying a solid ground, so each is drawn for
 * the theme it is named after — the black tile reads correctly on paper, the
 * white one on the dark composition. Swapping them is done in CSS rather than
 * by reading `resolvedTheme`, because next-themes only knows the resolved theme
 * after mount: a JS swap renders the wrong logo on the server, then corrects
 * itself on hydration, which is a visible flash on the first paint of every
 * page. The `.dark` class is already on <html> before paint, so a CSS rule
 * costs nothing and cannot flash. See `.brand-logo-*` in globals.css.
 *
 * `next/image` is safe here where it is not for article images: these are local
 * static files, so there is no remote-host allowlist to fall foul of.
 */

interface BrandMarkProps {
  /** Wordmark size in px. The tile scales with it. */
  size?: number;
  /** Tile only, for tight spaces. */
  markOnly?: boolean;
  className?: string;
}

export default function BrandMark({
  size = 17,
  markOnly = false,
  className = '',
}: BrandMarkProps) {
  // Beside the wordmark the tile matches the serif's cap height plus a little;
  // alone it is the whole mark and can be larger.
  const tile = Math.round(size * (markOnly ? 1.5 : 1.2));

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className="relative shrink-0 overflow-hidden rounded-[5px]"
        style={{ width: tile, height: tile }}
      >
        <Image
          src="/images/logo-light-mode.png"
          alt=""
          width={tile}
          height={tile}
          priority
          className="brand-logo-light h-full w-full object-cover"
        />
        <Image
          src="/images/logo-dark-mode.png"
          alt=""
          width={tile}
          height={tile}
          priority
          className="brand-logo-dark h-full w-full object-cover"
        />
      </span>

      {!markOnly && (
        <span
          className="font-display whitespace-nowrap text-[var(--foreground)]"
          style={{ fontSize: `${Math.round(size * 1.18)}px`, lineHeight: 1, letterSpacing: '-0.02em' }}
        >
          Ultra <span className="italic text-[var(--foreground-muted)]">News</span>
        </span>
      )}
    </span>
  );
}
