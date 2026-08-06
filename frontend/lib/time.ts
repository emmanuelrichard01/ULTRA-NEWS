/**
 * Relative time, tighter than date-fns' prose.
 *
 * `formatDistanceToNow` renders "about 10 hours ago" and "less than a minute
 * ago" — long enough that on a narrow column it wrapped a card's metadata line
 * onto two rows, and it hedges ("about") about a figure we know exactly. A feed
 * wants "10h ago".
 *
 * Lives in lib/ because three surfaces format the same instants — the feed
 * card, the overlay hero, and the sidebar panels — and a feed that says "10h
 * ago" beside a hero that says "about 10 hours ago" for the same story reads as
 * two products stitched together.
 */
export function relativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
