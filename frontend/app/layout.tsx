import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Ultra News",
    default: "Ultra News — Curated Intelligence for the Accelerated Mind",
  },
  description: "A high-performance news aggregation platform engineered for density, speed, and clarity. Tracking Tech, Politics, and Global Markets in real-time.",
  keywords: ["news aggregator", "tech news", "market intelligence", "minimalist news", "ultra news", "emmanuel richard moghalu"],
  authors: [{ name: "Emmanuel Richard Moghalu", url: "https://github.com/emmanuelrichard01" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://ultra-news.demo",
    siteName: "Ultra News",
    images: [
      {
        url: "/images/logo-light-mode.png",
        width: 1200,
        height: 630,
        alt: "Ultra News Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ultra News — The Information Instrument",
    creator: "@emmanuelrichard01",
  },
  icons: {
    icon: [
      { url: '/images/logo-light-mode.png', media: '(prefers-color-scheme: light)' },
      { url: '/images/logo-dark-mode.png', media: '(prefers-color-scheme: dark)' },
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
        className={`${inter.variable} antialiased h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Navbar />
          <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
