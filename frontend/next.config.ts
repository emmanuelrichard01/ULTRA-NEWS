import type { NextConfig } from "next";

/**
 * Image hosts.
 *
 * `hostname: "**"` allowed the optimizer to fetch from any host on the internet,
 * which turns the deployment into an open image proxy — anyone can drive
 * bandwidth and cache storage through it with arbitrary URLs.
 *
 * News images legitimately come from a long tail of publisher CDNs, so rather
 * than enumerating every one, the list is configurable per environment via
 * IMAGE_HOST_ALLOWLIST (comma-separated, wildcards allowed) and defaults to the
 * CDNs used by the sources in core/source_registry.py.
 */
const DEFAULT_IMAGE_HOSTS = [
  "**.bbci.co.uk",
  "**.bbc.co.uk",
  "**.guim.co.uk",
  "**.nytimes.com",
  "**.reuters.com",
  "**.reutersmedia.net",
  "**.apnews.com",
  "**.france24.com",
  "**.aljazeera.com",
  "**.npr.org",
  "**.cnn.com",
  "**.washingtonpost.com",
  "**.ft.com",
  "**.economist.com",
  "**.wsj.net",
  "**.arstechnica.net",
  "**.techcrunch.com",
  "**.theverge.com",
  "**.wired.com",
  "**.nature.com",
  "**.sciencemag.org",
  "**.espncdn.com",
  "**.cloudfront.net",
  "**.akamaized.net",
  "**.wp.com",
  "**.gstatic.com",
];

const imageHosts = (
  process.env.IMAGE_HOST_ALLOWLIST
    ? process.env.IMAGE_HOST_ALLOWLIST.split(",").map((h) => h.trim()).filter(Boolean)
    : DEFAULT_IMAGE_HOSTS
).map((hostname) => ({ protocol: "https" as const, hostname }));

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle for the production Docker image.
  output: "standalone",

  images: {
    remotePatterns: imageHosts,
    // Publisher images change behind stable URLs; a day of caching is plenty.
    minimumCacheTTL: 86400,
    formats: ["image/avif", "image/webp"],
  },

  // Don't advertise the framework version.
  poweredByHeader: false,

  // The social cards (opengraph-image.tsx) read their fonts from disk with
  // fs, which the bundler cannot trace from an import. Without this, the
  // font files are missing from the deployed function and every card that is
  // rendered on demand — story cards are — fails in production only.
  outputFileTracingIncludes: {
    '/**': ['./assets/og-fonts/**'],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            // microphone=(self), not (): "Ask by voice" needs it, and the
            // empty list disabled the mic for our own pages too — speech
            // recognition failed instantly with "not-allowed". `self` still
            // denies it to any embedded third-party frame.
            value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
