import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { corroborationScale } from './corroboration';

/**
 * Shared pieces for the generated social cards (`opengraph-image.tsx` files).
 *
 * The site shipped one static `og-image.png` for every page — a 1024×1024
 * square declared in metadata as 1200×630, so every platform cropped or
 * letterboxed it, and a shared story looked identical to a shared homepage.
 * A story's card now carries what the story page is about: the headline, the
 * number of independent newsrooms, and which ones.
 *
 * Satori renders these, so the usual CSS rules do not apply: layout is flex
 * only, every element with more than one child needs `display: flex`, and
 * only TTF/OTF/WOFF fonts load (not WOFF2). Colours are literal — CSS
 * variables do not exist here — and mirror the light palette in globals.css.
 */

export const OG_SIZE = { width: 1200, height: 630 };

export const INK = '#111214';
export const PAPER = '#fbfaf8';
export const MUTED = '#5b616b';
export const SUBTLE = '#8a8f98';
export const RULE = '#e4e2dc';
export const BRAND_BLUE = '#2563eb';

const LEVEL_COLOR = {
  single: SUBTLE,
  confirmed: '#b0701a',
  corroborated: '#17557f',
} as const;

export function levelColor(outlets: number): string {
  if (outlets >= 3) return LEVEL_COLOR.corroborated;
  if (outlets >= 2) return LEVEL_COLOR.confirmed;
  return LEVEL_COLOR.single;
}

export function corroborationSentence(outlets: number): string {
  if (outlets >= 3) return `Corroborated by ${outlets} independent newsrooms`;
  if (outlets === 2) return 'Confirmed by 2 independent newsrooms';
  return 'Reported by one newsroom — not yet confirmed';
}

/**
 * The fonts, read from the repo rather than fetched per render: a card is
 * generated on a crawler's first request, and a network hop to a font CDN is
 * the slowest, least reliable part of that. OFL-licensed; see assets/og-fonts.
 */
let fontsPromise: Promise<
  { name: string; data: Buffer; weight: 400 | 500; style: 'normal' | 'italic' }[]
> | null = null;

export function loadOgFonts() {
  if (!fontsPromise) {
    const dir = join(process.cwd(), 'assets', 'og-fonts');
    const load = (file: string) => readFile(join(dir, file));
    fontsPromise = Promise.all([
      load('InstrumentSerif-Regular.woff'),
      load('InstrumentSerif-Italic.woff'),
      load('Geist-Regular.woff'),
      load('Geist-Medium.woff'),
      load('IBMPlexMono-Medium.woff'),
    ]).then(([serif, serifItalic, sans, sansMedium, mono]) => [
      { name: 'Serif', data: serif, weight: 400, style: 'normal' },
      { name: 'Serif', data: serifItalic, weight: 400, style: 'italic' },
      { name: 'Sans', data: sans, weight: 400, style: 'normal' },
      { name: 'Sans', data: sansMedium, weight: 500, style: 'normal' },
      { name: 'Mono', data: mono, weight: 500, style: 'normal' },
    ]);
  }
  return fontsPromise;
}

/** The U mark, as vector — same geometry as /images/logo-*.png. */
export function LogoMark({ size = 44, tile = INK }: { size?: number; tile?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 500 500">
      <rect width="500" height="500" rx="110" fill={tile} />
      <path
        d="M124 104H204V270A46.5 46.5 0 0 0 297 270V177H376V270A126 126 0 0 1 124 270Z"
        fill="#ffffff"
      />
      <rect x="297" y="104" width="79" height="73" fill={BRAND_BLUE} />
    </svg>
  );
}

export function Wordmark({ color = INK, size = 30 }: { color?: string; size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <LogoMark size={size * 1.4} />
      <div style={{ display: 'flex', fontFamily: 'Serif', fontSize: size, color, letterSpacing: '-0.02em' }}>
        Ultra&nbsp;<span style={{ fontStyle: 'italic', opacity: 0.6 }}>News</span>
      </div>
    </div>
  );
}

/** Six rising bars, filled by corroboration — the meter on every card on the site. */
export function Meter({ outlets, scale = 1 }: { outlets: number; scale?: number }) {
  const color = levelColor(outlets);
  // The same curve as the site meter, imported rather than copied so the two
  // can never disagree about what "six outlets" looks like.
  const filled = outlets <= 0 ? 0 : Math.max(1, Math.round(corroborationScale(outlets) * 6));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5 * scale }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 7 * scale,
            height: (16 + i * 5) * scale,
            borderRadius: 2,
            backgroundColor: i < filled ? color : RULE,
          }}
        />
      ))}
    </div>
  );
}

/** Headline size that keeps three lines inside the card at 1200px. */
export function headlineSize(text: string, wide: boolean): number {
  const n = text.length;
  if (wide) return n < 55 ? 84 : n < 90 ? 70 : n < 130 ? 58 : 50;
  return n < 45 ? 70 : n < 75 ? 58 : n < 110 ? 48 : 42;
}

/**
 * A publisher photograph as a data URI, or null.
 *
 * Only JPEG and PNG (Satori cannot decode WebP or AVIF), under 2 MB, within
 * 3 seconds. Publisher CDNs hotlink-block, time out and serve odd formats
 * often enough that any failure simply drops the photo: a card without a
 * picture is fine, a card that fails to render is a broken share.
 */
export async function photoDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      headers: { 'User-Agent': 'UltraNewsCardBot/1.0 (+social card preview)' },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (type !== 'image/jpeg' && type !== 'image/png') return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 2_000_000) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export function hostLabel(siteUrl: string): string {
  try {
    return new URL(siteUrl).host;
  } catch {
    return 'ultra-news';
  }
}

/**
 * A card with a large title and up to three numbered stories under it, each
 * with its meter. Shared by the Briefing and topic cards, which make the same
 * promise: here is what is confirmed, and how well.
 */
export function ListCard({
  kicker,
  title,
  italic,
  stories,
}: {
  kicker: string;
  title: string;
  italic?: string;
  stories: { title: string; outlets: number }[];
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: '52px 64px 48px',
        background: PAPER,
        fontFamily: 'Sans',
        color: INK,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Wordmark size={26} />
        <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: 17, letterSpacing: '0.12em', textTransform: 'uppercase', color: SUBTLE }}>
          {kicker}
        </div>
      </div>

      <div style={{ display: 'flex', fontFamily: 'Serif', fontSize: 92, lineHeight: 1, letterSpacing: '-0.03em' }}>
        {title}
        {italic && <span style={{ fontStyle: 'italic', color: MUTED }}>&nbsp;{italic}</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', borderTop: `2px solid ${INK}` }}>
        {stories.slice(0, 3).map((s, i) => (
          <div
            key={i}
            style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '13px 0', borderBottom: i < Math.min(stories.length, 3) - 1 ? `1px solid ${RULE}` : 'none' }}
          >
            <div style={{ display: 'flex', width: 44, fontFamily: 'Serif', fontStyle: 'italic', fontSize: 30, color: SUBTLE }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <div style={{ display: 'block', flex: 1, fontSize: 25, fontWeight: 500, letterSpacing: '-0.01em', lineClamp: 1 }}>{s.title}</div>
            <Meter outlets={s.outlets} scale={0.7} />
            <div style={{ display: 'flex', width: 110, justifyContent: 'flex-end', fontFamily: 'Mono', fontSize: 17, color: levelColor(s.outlets) }}>
              {s.outlets} {s.outlets === 1 ? 'outlet' : 'outlets'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
