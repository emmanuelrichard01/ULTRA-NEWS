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
 *
 * ---
 *
 * What each edition declares here now goes beyond ordering, because the three
 * were rendering as the same page with a different word in the masthead. The
 * fields below are the differences that actually matter to a reader:
 *
 *   timeField      Which clock the reader should be watching. A chronological
 *                  edition means "first reported"; a momentum edition means
 *                  "last outlet joined". Developing showed `first_seen_at` and
 *                  so displayed "2 days ago" on rows whose entire premise was
 *                  that they are moving right now.
 *   floorOutlets   The corroboration floor the SERVER enforces, whatever the
 *                  reader picks. Developing filters `momentum_outlets >= 2`, so
 *                  a single-source story cannot appear there — while the filter
 *                  control cheerfully offered "All stories: everything on the
 *                  wire, including single-source reports". A control has to
 *                  describe a state the query can actually produce.
 *   showImages     Thumbnails earn their place in a chronological browse and
 *                  cost more than they return in a ranked list of what is
 *                  moving.
 */
export interface Edition {
  /** URL segment. Empty string is the home route. */
  slug: string;
  name: string;
  /** One line under the edition bar. Says what the ordering does. */
  tagline: string;
  /** Ordering, stated in a few words. */
  rubric: string;
  sort: StorySort;
  /** Minimum independent outlets, when the edition implies a floor. */
  minSources?: number;
  /**
   * Independent outlets the API guarantees regardless of the reader's filter.
   * Corroboration filters below this are not offered, because they would be
   * indistinguishable from each other.
   */
  floorOutlets: number;
  /** Which timestamp answers "when?" for this ordering. */
  timeField: 'first_seen_at' | 'last_updated_at';
  /** Word before the time, when the default reading would be wrong. */
  timePrefix?: string;
  /**
   * Whether this edition leads with a hero.
   *
   * The Wire's hero is fetched separately (see fetchLeadStory) rather than
   * taken from the top of the list, because the top of a recency ordering is
   * whatever landed last — usually a single unconfirmed report. The Record's
   * ordering already puts its best-evidenced story first, so its hero is just
   * that row promoted.
   */
  showLead: boolean;
  /** Label above the hero, naming the judgement that selected it. */
  leadKicker?: string;
  showRanks: boolean;
  showImages: boolean;
  /**
   * Two columns. Only The Wire: it is the landing page and the only edition
   * whose ordering leaves room for a second thing to look at. A sidebar beside
   * a ranking competes with the ranking.
   */
  showSidebar: boolean;
  /** The live-state strip. Meaningful on a chronological feed only. */
  showStatus: boolean;
  /**
   * The "not yet confirmed" column beside the lead.
   *
   * Only where single-source stories can actually appear. Developing and The
   * Record both enforce a floor above one independent outlet, so on those the
   * panel would be permanently empty — the same mistake the velocity
   * leaderboard made.
   */
  showUnconfirmed: boolean;
  emptyMessage: string;
}

export const EDITIONS: Edition[] = [
  {
    slug: '',
    name: 'The Wire',
    tagline:
      'Everything as it lands, newest first, with the number of independent outlets behind each story.',
    rubric: 'Newest first',
    sort: 'latest',
    floorOutlets: 1,
    timeField: 'first_seen_at',
    showLead: true,
    leadKicker: 'Latest confirmed',
    showRanks: false,
    showImages: true,
    showSidebar: true,
    showStatus: true,
    showUnconfirmed: true,
    emptyMessage:
      'Nothing has come across the wire yet. Stories appear here as soon as ingestion runs.',
  },
  {
    slug: 'developing',
    name: 'Developing',
    tagline:
      'Stories picking up independent coverage right now, ranked by how many new outlets joined in the last 12 hours.',
    rubric: 'By outlets gained in the last 12 hours',
    sort: 'momentum',
    // The momentum query requires two outlets inside the window, so this
    // edition begins at "confirmed" whatever the reader selects.
    floorOutlets: 2,
    // A story that first broke on Monday can be the fastest-moving thing on the
    // wire on Wednesday. The clock that matters is the last outlet to join.
    timeField: 'last_updated_at',
    timePrefix: 'updated',
    showLead: false,
    showRanks: true,
    // Was false, on the argument that thumbnails are noise in a ranked list of
    // what is moving. In practice a reader arriving at Developing from an
    // edition that has pictures reads their absence as a page that failed to
    // load, not as an editorial choice — and the three editions looking like
    // three different products is a worse outcome than a slightly denser list.
    showImages: true,
    showSidebar: false,
    showStatus: false,
    showUnconfirmed: false,
    emptyMessage:
      'Nothing is accelerating right now. Stories appear here when fresh outlets pick them up.',
  },
  {
    slug: 'record',
    name: 'The Record',
    tagline:
      'Independently corroborated reporting, ordered by weight of evidence rather than recency.',
    rubric: 'By independent corroboration',
    sort: 'significance',
    minSources: 3,
    floorOutlets: 3,
    timeField: 'first_seen_at',
    showLead: true,
    leadKicker: 'Best corroborated',
    showRanks: true,
    showImages: true,
    showSidebar: false,
    showStatus: false,
    showUnconfirmed: false,
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
