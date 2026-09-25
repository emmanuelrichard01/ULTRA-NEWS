import type { MetadataRoute } from 'next';

import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';

/**
 * Web app manifest, typed and generated.
 *
 * Replaces public/site.webmanifest, which carried the old warm-paper theme
 * colour and no shortcuts. Shortcuts surface in the OS when the site is
 * installed (long-press on Android, right-click in the dock/taskbar): the
 * three destinations a returning reader actually wants.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    id: '/',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbfaf8',
    theme_color: '#111214',
    categories: ['news', 'magazines'],
    lang: 'en',
    dir: 'ltr',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'The Briefing',
        short_name: 'Briefing',
        description: 'Today’s confirmed stories in two minutes',
        url: '/briefing?source=pwa-shortcut',
      },
      {
        name: 'Developing',
        description: 'Stories gaining independent outlets right now',
        url: '/developing?source=pwa-shortcut',
      },
      {
        name: 'The Record',
        description: 'Corroborated reporting, ordered by weight of evidence',
        url: '/record?source=pwa-shortcut',
      },
    ],
  };
}
