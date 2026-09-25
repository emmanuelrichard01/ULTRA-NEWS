/**
 * Sharing, without a single third-party script.
 *
 * Every network below takes a plain "intent" URL, so sharing is a link that
 * opens the network's own composer. That rules out the official SDK widgets —
 * each one loads tracking scripts on every page it sits on, which would need
 * a consent banner and slows every page for the minority who share.
 *
 * Two product decisions live here:
 *
 *   The evidence travels with the share. The pre-filled text leads with the
 *   corroboration count — "Corroborated by 9 independent newsrooms: …" — so
 *   the one number this product exists for appears in the feed it lands in,
 *   next to the generated card that says the same.
 *
 *   Every shared link is tagged (utm_source=<network>) so analytics can say
 *   which networks bring readers back. The page's canonical URL is untagged,
 *   so search engines see one address however it was shared.
 */

export type ShareNetwork =
  | 'whatsapp'
  | 'x'
  | 'bluesky'
  | 'threads'
  | 'linkedin'
  | 'telegram'
  | 'reddit'
  | 'email';

export interface ShareTarget {
  network: ShareNetwork;
  label: string;
}

/** Ordered by how news actually gets passed on: messaging first, then feeds. */
export const SHARE_TARGETS: ShareTarget[] = [
  { network: 'whatsapp', label: 'WhatsApp' },
  { network: 'x', label: 'X' },
  { network: 'bluesky', label: 'Bluesky' },
  { network: 'threads', label: 'Threads' },
  { network: 'linkedin', label: 'LinkedIn' },
  { network: 'telegram', label: 'Telegram' },
  { network: 'reddit', label: 'Reddit' },
  { network: 'email', label: 'Email' },
];

export interface SharePayload {
  /** Absolute canonical URL of the page. */
  url: string;
  /** The headline or page title. */
  title: string;
  /** Evidence line, e.g. "Corroborated by 9 independent newsrooms". */
  evidence?: string;
}

/** The canonical URL with campaign tags for one network. */
export function taggedUrl(url: string, source: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', source);
    u.searchParams.set('utm_medium', 'social');
    u.searchParams.set('utm_campaign', 'share');
    return u.toString();
  } catch {
    return url;
  }
}

/** "Corroborated by 9 independent newsrooms: <headline>" — or just the headline. */
export function shareText({ title, evidence }: SharePayload): string {
  return evidence ? `${evidence}: ${title}` : title;
}

/** The network's own composer, pre-filled. */
export function shareHref(network: ShareNetwork, payload: SharePayload): string {
  const url = taggedUrl(payload.url, network);
  const text = shareText(payload);
  const e = encodeURIComponent;

  switch (network) {
    case 'whatsapp':
      return `https://wa.me/?text=${e(`${text}\n${url}`)}`;
    case 'x':
      return `https://x.com/intent/post?text=${e(text)}&url=${e(url)}`;
    case 'bluesky':
      return `https://bsky.app/intent/compose?text=${e(`${text} ${url}`)}`;
    case 'threads':
      return `https://www.threads.net/intent/post?text=${e(`${text} ${url}`)}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${e(url)}&text=${e(text)}`;
    case 'reddit':
      return `https://www.reddit.com/submit?url=${e(url)}&title=${e(payload.title)}`;
    case 'email':
      return `mailto:?subject=${e(payload.title)}&body=${e(`${text}\n\n${url}\n\nVia Ultra News — every story, counted by the independent newsrooms behind it.`)}`;
  }
}

/** The evidence line for a story's share text. */
export function storyEvidence(outlets: number): string {
  if (outlets >= 3) return `Corroborated by ${outlets} independent newsrooms`;
  if (outlets === 2) return 'Confirmed by 2 independent newsrooms';
  return 'Reported by one newsroom, not yet confirmed';
}
