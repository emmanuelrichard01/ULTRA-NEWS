/**
 * Framing analysis — how differently outlets headlined the same event.
 *
 * Two newsrooms reporting identical facts choose different subjects, different
 * verbs and different omissions. Laying those side by side shows editorial
 * slant more honestly than any bias score could, because the reader draws the
 * conclusion from primary evidence rather than trusting our label.
 *
 * This lives in lib/ rather than inside a component because two surfaces need
 * the same answer: the feed card, which previews the divergence, and the story
 * page's FramingMatrix, which shows it in full. They previously would have had
 * two copies of the word analysis, which is exactly how the marking on one
 * surface drifts out of agreement with the other — the same story would
 * highlight different words depending on which page you were looking at.
 */

/**
 * Words too common to carry framing. "Strikes" versus "operation" is the
 * story; "the" versus "the" is not.
 *
 * Reporting verbs (`says`, `said`, `reports`) are included deliberately: they
 * mark attribution, which nearly every wire headline carries, so treating them
 * as distinctive would highlight the one thing outlets have in common.
 */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for',
  'with', 'as', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'it',
  'its', 'that', 'this', 'has', 'have', 'had', 'will', 'says', 'say', 'said',
  'after', 'over', 'into', 'more', 'than', 'his', 'her', 'their', 'they',
  'reports', 'report', 'amid', 'new', 'up', 'out', 'off', 'who', 'what',
]);

/** One outlet's framing of a story. Both call sites narrow to this shape. */
export interface FramingEntry {
  source: string;
  title: string;
}

/** Content words of a headline, lowercased, stopwords removed. */
function contentWords(title: string): string[] {
  return (title.toLowerCase().match(/\b[a-z][a-z'-]{2,}\b/g) ?? []).filter(
    (w) => !STOPWORDS.has(w)
  );
}

/** Normalise a display token so it can be tested against the word set. */
export function bareWord(token: string): string {
  return token.toLowerCase().replace(/[^a-z'-]/g, '');
}

/**
 * Words used by exactly one outlet across the supplied framings.
 *
 * Needs at least two framings to mean anything: with one headline every word
 * is trivially unique to it, which would mark the entire line and tell the
 * reader nothing.
 */
export function distinctiveWords(framings: FramingEntry[]): Set<string> {
  if (framings.length < 2) return new Set();

  const counts = new Map<string, number>();
  framings.forEach((f) => {
    // Per-outlet Set first, so an outlet repeating a word doesn't inflate the
    // count past 1 and disqualify a word that only it actually used.
    new Set(contentWords(f.title)).forEach((w) =>
      counts.set(w, (counts.get(w) ?? 0) + 1)
    );
  });

  return new Set(
    [...counts.entries()].filter(([, n]) => n === 1).map(([w]) => w)
  );
}

/** True when this display token should be marked. */
export function isDistinctive(token: string, distinctive: Set<string>): boolean {
  const bare = bareWord(token);
  return bare.length > 2 && distinctive.has(bare);
}

/**
 * The words to actually mark in one headline.
 *
 * "Appears in exactly one outlet" is the right test but a blunt instrument on
 * short inputs. Across three headlines of a dozen words, almost every content
 * word is unique to one of them, and marking eleven words out of twelve tells
 * the reader nothing — highlighting everything is the same as highlighting
 * nothing, and it made the panel look like a redaction.
 *
 * Observed on a live cluster, the unfiltered rule marked "least, eight, hit,
 * online, retailer, warehouse, officials" in a single headline. The three that
 * carry the framing are "retailer", "warehouse", "officials"; the rest are
 * function words that happened to survive the stopword list.
 *
 * So the distinctive set is ranked and capped. Length is the ranking, which is
 * crude but holds up well here: the words that carry a newsroom's angle are
 * nouns and verbs of substance ("Wildberries", "warehouse", "retaliatory"),
 * and the ones that slip through are short ("hit", "near", "least"). Ties keep
 * their order in the headline so the marking is stable across renders.
 */
const MAX_MARKS_PER_HEADLINE = 3;

export function marksFor(
  title: string,
  distinctive: Set<string>,
  max: number = MAX_MARKS_PER_HEADLINE
): Set<string> {
  const present = [...new Set(contentWords(title))].filter((w) =>
    distinctive.has(w)
  );

  if (present.length <= max) return new Set(present);

  return new Set(
    present
      .map((w, i) => ({ w, i }))
      .sort((a, b) => b.w.length - a.w.length || a.i - b.i)
      .slice(0, max)
      .map(({ w }) => w)
  );
}

/**
 * Split a headline into tokens that preserve their whitespace, so marked and
 * unmarked runs reassemble into the original line exactly.
 */
export function tokenize(title: string): string[] {
  return title.split(/(\s+)/);
}

/**
 * One framing per outlet, earliest first.
 *
 * Earliest matters: an outlet's first headline is its own framing, before it
 * had a chance to follow anyone else's lead. Later rewrites converge.
 */
export function framingsByOutlet<T extends FramingEntry & { publishedAt?: string }>(
  entries: T[]
): T[] {
  const byOutlet = new Map<string, T>();
  [...entries]
    .sort((a, b) => {
      if (!a.publishedAt || !b.publishedAt) return 0;
      return new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
    })
    .forEach((entry) => {
      if (!byOutlet.has(entry.source)) byOutlet.set(entry.source, entry);
    });
  return [...byOutlet.values()];
}

/**
 * Whether a set of framings diverges enough to be worth surfacing.
 *
 * Clusters routinely carry two outlets running the same syndicated headline
 * verbatim. Offering "compare 2 framings" on those spends the reader's
 * attention to show them the same sentence twice.
 */
export function hasDivergence(framings: FramingEntry[]): boolean {
  if (framings.length < 2) return false;
  const normalised = new Set(
    framings.map((f) => f.title.toLowerCase().replace(/\s+/g, ' ').trim())
  );
  if (normalised.size < 2) return false;
  return distinctiveWords(framings).size > 0;
}
