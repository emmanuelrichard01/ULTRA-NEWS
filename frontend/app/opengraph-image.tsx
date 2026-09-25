import { ImageResponse } from 'next/og';

import { BRAND_BLUE, INK, LogoMark, OG_SIZE, loadOgFonts } from '@/lib/og';

/**
 * The default share card — the home page, and every route without its own.
 *
 * Replaces public/og-image.png, a 1024×1024 square the metadata declared as
 * 1200×630: platforms cropped it to a logo fragment. This one is drawn at the
 * true size and says what the product is, in its own type.
 */

export const alt = 'Ultra News — every story, counted by the independent newsrooms behind it';
export const size = OG_SIZE;
export const contentType = 'image/png';

const DEMO = [
  { label: 'One outlet', filled: 1, color: '#8a8f98' },
  { label: 'Confirmed', filled: 3, color: '#e3a650' },
  { label: 'Corroborated', filled: 6, color: '#6aa8df' },
];

export default async function Image() {
  const fonts = await loadOgFonts();

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '60px 68px',
          background: `radial-gradient(120% 90% at 100% 0%, #1b2a3d 0%, ${INK} 55%)`,
          color: '#f5f4f0',
          fontFamily: 'Sans',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <LogoMark size={52} tile="#1d1f23" />
          <div style={{ display: 'flex', fontFamily: 'Serif', fontSize: 34, letterSpacing: '-0.02em' }}>
            Ultra&nbsp;<span style={{ fontStyle: 'italic', color: '#a0a5ae' }}>News</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontFamily: 'Serif', fontSize: 104, lineHeight: 0.98, letterSpacing: '-0.03em' }}>
            Every story,
          </div>
          <div style={{ display: 'flex', fontFamily: 'Serif', fontStyle: 'italic', fontSize: 104, lineHeight: 0.98, letterSpacing: '-0.03em', color: '#a0a5ae' }}>
            counted.
          </div>
          <div style={{ display: 'flex', marginTop: 26, fontSize: 28, color: '#c9ccd2', maxWidth: 820, lineHeight: 1.35 }}>
            Coverage grouped by event, with the number of independent newsrooms standing behind it.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 44 }}>
          {DEMO.map((row) => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    style={{ width: 6, height: 14 + i * 4, borderRadius: 2, backgroundColor: i < row.filled ? row.color : '#2b2e34' }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: 18, color: '#a0a5ae' }}>{row.label}</div>
            </div>
          ))}
          <div style={{ display: 'flex', marginLeft: 'auto', width: 14, height: 14, backgroundColor: BRAND_BLUE }} />
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
