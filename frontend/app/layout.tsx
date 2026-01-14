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
    default: "Ultra News - The Daily Intelligence Stream",
  },
  description: "A modern, high-density news aggregator for tech, business, and world events. Zero friction, maximum intelligence.",
  keywords: ["news", "aggregator", "tech", "business", "politics", "science", "ultra news"],
  authors: [{ name: "Ultra News Team" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://ultra-news.demo",
    siteName: "Ultra News",
    images: [
      {
        url: "/og-image.jpg", // We would ideally have a real OG image here
        width: 1200,
        height: 630,
        alt: "Ultra News",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ultra News - The Daily Intelligence Stream",
    creator: "@ultranews",
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
