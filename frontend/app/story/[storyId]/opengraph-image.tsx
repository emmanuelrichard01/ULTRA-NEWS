import { ImageResponse } from 'next/og';

import { fetchStory } from '@/lib/api';
import {
  INK,
  MUTED,
  Meter,
  OG_SIZE,
  PAPER,
  SUBTLE,
  Wordmark,
  corroborationSentence,
  headlineSize,
  levelColor,
  loadOgFonts,
  photoDataUri,
} from '@/lib/og';
import { groupByOutlet } from '@/lib/outlets';
import { CATEGORY_MAP } from '@/lib/types';

/**
 * The share card for a story: what a link to it looks like in a feed.
 *
 * It says what the product says — the headline, and how many independent
 * newsrooms stand behind it, and which — so a shared story carries its
 * evidence with it instead of a generic logo tile. Regenerated with the page.
 */

export const alt = 'Story headline with the number of independent newsrooms reporting it, on Ultra News';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 300;

export default async function Image({ params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  const [fonts, story] = await Promise.all([loadOgFonts(), fetchStory(storyId)]);

  if (!story) {
    return new ImageResponse(
      (
        <div style={{ display: 'flex', width: '100%', height: '100%', background: PAPER, padding: 64, alignItems: 'flex-end' }}>
          <Wordmark size={40} />
        </div>
      ),
      { ...size, fonts }
    );
  }

  const articles = [...(story.articles ?? [])].sort(
    (a, b) => new Date(a.published_date).getTime() - new Date(b.published_date).getTime()
  );
  const outlets = groupByOutlet(articles).map((o) => o.name);
  const count = story.independent_count;
  const photo = await photoDataUri(articles.find((a) => a.image_url)?.image_url);
  const category = story.categories?.[0];
  const dateline = [
    category ? CATEGORY_MAP[category]?.displayName ?? category : null,
    new Date(story.first_seen_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  ]
    .filter(Boolean)
    .join('  ·  ');
  const outletLine =
    outlets.slice(0, 4).join('  ·  ') + (outlets.length > 4 ? `  +${outlets.length - 4} more` : '');

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: PAPER, fontFamily: 'Sans' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: photo ? 740 : 1200,
            padding: '52px 60px 50px',
          }}
        >
          <Wordmark size={26} />

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                fontFamily: 'Mono',
                fontSize: 17,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: SUBTLE,
              }}
            >
              {dateline}
            </div>
            <div
              style={{
                display: 'block',
                marginTop: 16,
                fontFamily: 'Serif',
                fontSize: headlineSize(story.title, !photo),
                lineHeight: 1.02,
                letterSpacing: '-0.02em',
                color: INK,
                lineClamp: 3,
                textWrap: 'balance',
              }}
            >
              {story.title}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', borderTop: `2px solid ${INK}`, paddingTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <Meter outlets={count} />
              <div style={{ display: 'flex', fontSize: 29, fontWeight: 500, color: levelColor(count), letterSpacing: '-0.01em' }}>
                {corroborationSentence(count)}
              </div>
            </div>
            {outletLine && (
              <div style={{ display: 'flex', marginTop: 12, fontFamily: 'Mono', fontSize: 18, color: MUTED }}>
                {outletLine}
              </div>
            )}
          </div>
        </div>

        {photo && (
          <div style={{ display: 'flex', width: 460, height: '100%', padding: '24px 24px 24px 0' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders <img>, not next/image */}
            <img src={photo} alt="" width={436} height={582} style={{ width: 436, height: 582, objectFit: 'cover', borderRadius: 22 }} />
          </div>
        )}
      </div>
    ),
    { ...size, fonts }
  );
}
