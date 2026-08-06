import type { StorySort } from './api';

/**
 * Editions — three lenses on one corpus.
 *
 * The previous three destinations (The Wire / Developing / Reporting) split
 * stories by a static corroboration count. On a representative run that gave
 * 419 / 12 / 12: one page held 95% of the content and two were permanently
 * near-empty. The names also described our pipeline's internal state rather
 * than any way a person wants to read.
 *
 * Each edition here is a different ORDERING of the whole corpus, not a slice of
 * it, so none can run dry:
 *
 *   The Wire    everything, newest first — the firehose
 *   Developing  stories gaining independent outlets right now — momentum
 *   The Record  corroborated and settled, by weight of evidence — the digest
 *
 * "Developing" is the one worth dwelling on. It ranks by outlets that picked a
 * story up inside a recent window, so a story appears while coverage is
 * actually accelerating and drops out once it settles. That is what the word
 * means, and it's a view no other news product offers — it's only possible
 * because we track which independent publishers joined a cluster and when.
 */
export interface Edition {
  /** URL segment. Empty string is the home route. */
  slug: string;
  name: string;
  /** One line under the masthead. */
  tagline: string;
  /** What the ordering actually does — shown as a caption. */
  rubric: string;
  sort: StorySort;
  /** Minimum independent outlets, when the edition implies a floor. */
  minSources?: number;
  showLead: boolean;
  showLeaderboard: boolean;
  emptyMessage: string;
}

export const EDITIONS: Edition[] = [
  {
    slug: '',
    name: 'The Wire',
    tagline:
      'Every story as it lands, with the receipts. We cluster coverage of the same event and show how many independent outlets stand behind it.',
    rubric: 'Newest first',
    sort: 'latest',
    showLead: true,
    showLeaderboard: true,
    emptyMessage:
      'Nothing has come across the wire yet. Stories appear here as soon as ingestion runs.',
  },
  {
    slug: 'developing',
    name: 'Developing',
    tagline:
      'Stories picking up independent coverage right now. Ranked by how many new outlets joined in the last 12 hours — so a story appears while it is accelerating, and leaves once it settles.',
    rubric: 'By outlets gained in the last 12 hours',
    sort: 'momentum',
    showLead: false,
    showLeaderboard: false,
    emptyMessage:
      'Nothing is accelerating right now. Stories appear here when fresh outlets pick them up.',
  },
  {
    slug: 'record',
    name: 'The Record',
    tagline:
      'Independently corroborated reporting, ordered by weight of evidence rather than recency. What multiple newsrooms agree happened.',
    rubric: 'By independent corroboration',
    sort: 'significance',
    minSources: 3,
    showLead: true,
    showLeaderboard: false,
    emptyMessage:
      'No story has yet reached three independent outlets. Corroboration takes time.',
  },
];

export const EDITIONS_BY_SLUG: Record<string, Edition> = Object.fromEntries(
  EDITIONS.map((e) => [e.slug, e])
);

export function editionHref(edition: Edition): string {
  return edition.slug ? `/${edition.slug}` : '/';
}
