import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ReactQueryProvider } from "@/components/ReactQueryProvider";
import { AskProvider } from "@/components/AskProvider";
import {
  IS_INDEXABLE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from "@/lib/site";

// V3 Typography — three-role system, all self-hosted via next/font
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  // Every absolute URL in the app resolves from here. See lib/site.ts for why
  // this stopped being three separate, disagreeing constants.
  metadataBase: new URL(SITE_URL),
  title: {
    template: "%s | Ultra News",
    default: "Ultra News — corroborated news, by the numbers",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "news aggregator",
    "story clustering",
    "corroborated news",
    "independent sources",
    "media bias comparison",
    "news verification",
    "ultra news",
  ],
  authors: [{ name: "Emmanuel Richard Moghalu", url: "https://github.com/emmanuelrichard01" }],
  creator: "Emmanuel Richard Moghalu",
  publisher: SITE_NAME,
  // The canonical for every other route is set by that route; this covers the
  // home page and gives the rest a base to resolve against.
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": [{ url: "/rss", title: "Ultra News RSS" }] },
  },
  // Previews and branch deployments must not be indexed — they would compete
  // with production for the same content. See IS_INDEXABLE.
  robots: IS_INDEXABLE
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
          "max-video-preview": -1,
        },
      }
    : { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Ultra News — corroborated news, by the numbers",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ultra News — coverage grouped by event, with the number of independent outlets behind it",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ultra News — corroborated news, by the numbers",
    description: SITE_DESCRIPTION,
    creator: "@emmanuelrichard01",
    images: ["/og-image.png"],
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

/**
 * Theme colour follows the composition rather than a single hex.
 *
 * The manifest can only carry one, so the browser chrome matched the paper
 * ground in both themes and looked wrong against the dark one.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
  colorScheme: "light dark",
};

/**
 * Site-level structured data.
 *
 * Two graphs, both true of every page:
 *
 *   Organization  who publishes this, with the logo that already exists in
 *                 /public/images. Without it a search engine has no entity to
 *                 attach the site to and picks whatever it can infer.
 *   WebSite       enables the sitelinks search box, and `isAccessibleForFree`
 *                 states plainly that nothing here is paywalled.
 *
 * Deliberately NOT claiming `NewsMediaOrganization`: Ultra News does not report
 * anything. It indexes and measures other newsrooms' work, links out, and says
 * so in its own footer — declaring itself a news publisher in structured data
 * would contradict that on the one surface nobody reads but every crawler does.
 */
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': absoluteUrl('/#organization'),
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl('/images/logo-light-mode.png'),
        width: 512,
        height: 512,
      },
      sameAs: ['https://github.com/emmanuelrichard01/ULTRA-NEWS'],
    },
    {
      '@type': 'WebSite',
      '@id': absoluteUrl('/#website'),
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      publisher: { '@id': absoluteUrl('/#organization') },
      inLanguage: 'en',
      isAccessibleForFree: true,
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {/* Emitted only where it can be crawled. A preview deployment
            advertising itself as the Ultra News organisation is a duplicate
            entity, not a bonus. */}
        {IS_INDEXABLE && (
          <script
            type="application/ld+json"
            // The payload is a literal defined above — no user or API content
            // reaches it, so there is nothing here to escape.
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          />
        )}
      </head>
      <body
        className={`${fraunces.variable} ${geist.variable} ${ibmPlexMono.variable} antialiased h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]`}
        style={{ fontFamily: "var(--font-geist), system-ui, sans-serif" }}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ReactQueryProvider>
            {/*
              AskProvider owns the one Ask dialog and the one ⌘K listener, so
              both work on every route rather than only the four that render
              FeedPage. See the component for what that was costing.
            */}
            <AskProvider>
              {/* Skip link — the nav carries editions, topics and Ask, which is
                  a lot to tab past on every page. */}
              <a
                href="#main"
                className="text-body-sm sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[var(--radius-chip)] focus:bg-[var(--foreground)] focus:px-4 focus:py-2 focus:text-[var(--background)]"
              >
                Skip to content
              </a>
              <Navbar />
              {/*
                BreakingNewsTicker used to sit here. It rendered `null` whenever
                it held no stories, and it only ever filled from SSE
                `new_story` events — so on a fresh page load it was empty, and
                stayed empty until ingestion happened to run while the reader
                was still on the page. In exchange for showing nothing it opened
                an EventSource to the backend on every route, and its one hover
                style referenced `var(--primary)`, which is not a token this
                design system defines.

                A marquee directly above the fold also works against the whole
                point of the feed redesign, which was to get a headline onto the
                first screen. Removed rather than restyled: The Wire already is
                the live view, and it is populated.
              */}
              {/* Pages set their own max-width — the feed reads at 6xl, articles
                  and the story page at 3xl for a comfortable measure. A single
                  7xl wrapper here forced every page to the widest one. */}
              <main id="main" className="w-full flex-grow px-4 py-10 sm:px-6 sm:py-12">
                {children}
              </main>
              <Footer />
            </AskProvider>
          </ReactQueryProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
