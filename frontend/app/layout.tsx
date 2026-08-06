import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ReactQueryProvider } from "@/components/ReactQueryProvider";
import BreakingNewsTicker from "@/components/BreakingNewsTicker";

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://ultra-news.demo"),
  title: {
    template: "%s | Ultra News",
    default: "Ultra News — The Wire Room",
  },
  description: "A story-centric news aggregation platform. We triangulate coverage from multiple sources so you see the full picture, not just one outlet's take.",
  keywords: ["news aggregator", "story clustering", "corroborated news", "multi-source", "ultra news"],
  authors: [{ name: "Emmanuel Richard Moghalu", url: "https://github.com/emmanuelrichard01" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://ultra-news.demo",
    siteName: "Ultra News",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ultra News — The Wire Room",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ultra News — The Wire Room",
    creator: "@emmanuelrichard01",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'manifest', url: '/site.webmanifest' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body
        className={`${fraunces.variable} ${geist.variable} ${ibmPlexMono.variable} antialiased h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]`}
        style={{ fontFamily: "var(--font-geist), system-ui, sans-serif" }}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ReactQueryProvider>
            {/* Skip link — the nav carries editions, topics and search, which is
                a lot to tab past on every page. */}
            <a
              href="#main"
              className="text-body-sm sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[var(--radius-chip)] focus:bg-[var(--foreground)] focus:px-4 focus:py-2 focus:text-[var(--background)]"
            >
              Skip to content
            </a>
            <Navbar />
            <BreakingNewsTicker />
            {/* Pages set their own max-width — the feed reads at 6xl, articles
                and the story page at 3xl for a comfortable measure. A single
                7xl wrapper here forced every page to the widest one. */}
            <main id="main" className="w-full flex-grow px-4 py-10 sm:px-6 sm:py-12">
              {children}
            </main>
            <Footer />
          </ReactQueryProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
