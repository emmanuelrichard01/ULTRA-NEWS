import { ImageResponse } from 'next/og';

import { fetchBriefing } from '@/lib/api';
import { ListCard, OG_SIZE, loadOgFonts } from '@/lib/og';

/** The Briefing's share card: today's date and the three best-confirmed stories. */

export const alt = 'The Briefing on Ultra News — today’s stories confirmed by independent newsrooms';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 1800;

export default async function Image() {
  const [fonts, briefing] = await Promise.all([loadOgFonts(), fetchBriefing()]);
  const date = new Date(briefing?.generated_at ?? Date.now()).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return new ImageResponse(
    (
      <ListCard
        kicker={`The Briefing · ${date}`}
        title="Today,"
        italic="confirmed."
        stories={(briefing?.items ?? []).map((i) => ({ title: i.title, outlets: i.independent_count }))}
      />
    ),
    { ...size, fonts }
  );
}
