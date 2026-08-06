/**
 * Excerpt cleanup, shared by every surface that shows a standfirst.
 *
 * Lives in lib/ because the feed card and the overlay hero both display the
 * same publisher text next to the same headline. When only one of them cleaned
 * it, the front page hero printed its own headline at display size and then
 * again immediately beneath — "Faced with a teleprompter glitch, Canada's
 * Carney mocks Trump", then "Faced with a teleprompter glitch, Canada's Carney
 * mocks Trump TORONTO, Aug 5 - When his teleprompter malfunctioned…".
 */

/**
 * Trim an excerpt that opens by repeating the headline, and decode the entities
 * that survive ingestion.
 *
 * Fixing this in the view rather than at ingest is deliberate: the excerpt is
 * the publisher's text and we store it as given. This changes only what we
 * choose to display, and only where it is redundant with something already on
 * screen.
 */
/**
 * Text that is the publisher's page furniture rather than the story.
 *
 * Some feeds carry a scraper's view of the article rather than the article, so
 * the stored summary is a bot wall or a paywall notice. One of these reached
 * the front page hero: under a headline about a rescue of 300 kidnapping
 * victims, the standfirst read "Java Script is disabled in your browser. Please
 * enable Java Script to proceed. A required part of this site couldn't load."
 *
 * Anchored near the start and matched on whole phrases, so an article that
 * genuinely discusses JavaScript or subscriptions is not silently blanked.
 */
const BOILERPLATE = [
  /java\s?script is (?:disabled|not enabled|required)/i,
  /please enable java\s?script/i,
  /enable java\s?script (?:in your browser|to (?:proceed|continue))/i,
  /(?:a )?required part of this (?:site|page) (?:couldn'?t|could not) load/i,
  /your browser (?:is out of date|does not support)/i,
  /(?:subscribe|sign in|log in) to (?:continue|read|keep) reading/i,
  /this (?:content|article) is (?:for|available to) subscribers/i,
  /we'?ve detected (?:that )?you'?re using an ad ?blocker/i,
  /access to this page has been denied/i,
  /(?:are you a robot|verify you are (?:a )?human)/i,
];

function isBoilerplate(text: string): boolean {
  // Only the opening of the excerpt is tested. A story that mentions paywalls
  // in its fourth sentence is still a story.
  const opening = text.slice(0, 160);
  return BOILERPLATE.some((re) => re.test(opening));
}

export function cleanExcerpt(excerpt: string | undefined, title: string): string {
  if (!excerpt) return '';

  const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

  // Undecoded entities arrive from publisher RSS and render literally: one live
  // card read "governing body&nbsp;on Wednesday". React escapes text nodes, so
  // an entity that survives ingestion reaches the reader as source. Only the
  // handful that actually appear are decoded — running arbitrary publisher text
  // through an HTML parser to render it as text would be a strange trade for a
  // space character.
  let out = excerpt
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    // A sentence running straight into the next with no space ("2026Just two
    // years after…") is an artefact of stripped markup, not the publisher's
    // prose.
    .replace(/([a-z0-9])([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  // Showing nothing is better than showing the publisher's bot wall under a
  // headline — the card still has its outlet, its timestamp and its
  // corroboration count, all of which are true.
  if (isBoilerplate(out)) return '';

  if (normalise(out).startsWith(normalise(title))) {
    out = out.slice(title.length).trim();
    // Strip a dateline left behind at the join, e.g. "TORONTO, Aug 5 - ".
    out = out.replace(
      /^[A-Z][A-Za-z.\s]{0,30},?\s*[A-Z][a-z]{2}\s+\d{1,2}\s*[-–—]\s*/,
      ''
    );
    out = out.replace(/^[\s—–\-:,.]+/, '');
  }

  // If the trim left nothing meaningful, showing a fragment is worse than
  // showing no standfirst at all.
  return out.length < 40 ? '' : out;
}
