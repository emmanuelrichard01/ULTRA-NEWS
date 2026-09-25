import { ImageResponse } from 'next/og';

import { fetchStories } from '@/lib/api';
import { ListCard, OG_SIZE, loadOgFonts } from '@/lib/og';
import { CATEGORY_MAP } from '@/lib/types';

/** A topic's share card: the beat's name and its best-confirmed recent stories. */

export const alt = 'A topic on Ultra News, with its best-corroborated recent stories';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 900;
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(CATEGORY_MAP).map((category) => ({ category }));
}

export default async function Image({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const topic = CATEGORY_MAP[category];
  const [fonts, page] = await Promise.all([
    loadOgFonts(),
    fetchStories({ category, sort: 'latest', minSources: 2, limit: 3 }),
  ]);

  return new ImageResponse(
    (
      <ListCard
        kicker={topic ? topic.description : 'Topic'}
        title={topic?.displayName ?? 'Ultra News'}
        stories={page.items.map((s) => ({ title: s.title, outlets: s.independent_count }))}
      />
    ),
    { ...size, fonts }
  );
}
