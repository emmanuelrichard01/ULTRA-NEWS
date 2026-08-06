/**
 * Corroboration vocabulary — single source of truth.
 *
 * The product used to expose its pipeline's internal state as three top-level
 * destinations: "The Wire", "Developing", "Reporting". Three problems with that:
 *
 *   1. It was wildly unbalanced. On a representative run: 419 single-source
 *      stories, 12 developing, 12 corroborated. One page held 95% of the content
 *      and two were permanently near-empty.
 *   2. "Developing" and "Reporting" are near-synonyms in newsroom usage, so the
 *      distinction read as arbitrary rather than meaningful.
 *   3. It described how OUR pipeline classifies a story, not anything a reader
 *      wants. Nobody arrives wanting "the developing tier".
 *
 * Corroboration is now a property you filter and sort by, shown on every card —
 * not a place you navigate to. The vocabulary below is deliberately concrete:
 * it states the evidence ("4 outlets") rather than a verdict.
 */

export type CorroborationLevel = 'single' | 'confirmed' | 'corroborated';

export interface CorroborationDescriptor {
  level: CorroborationLevel;
  /** Short label for chips and badges. */
  label: string;
  /** Sentence-form description for tooltips and screen readers. */
  description: (outlets: number) => string;
  /** CSS custom property holding this level's colour. */
  colorVar: string;
}

export const CORROBORATION: Record<CorroborationLevel, CorroborationDescriptor> = {
  single: {
    level: 'single',
    label: 'Single source',
    description: () => 'Reported by one outlet. Not yet independently confirmed.',
    colorVar: '--foreground-subtle',
  },
  confirmed: {
    level: 'confirmed',
    label: 'Confirmed',
    description: (n) => `Independently confirmed by ${n} outlets.`,
    colorVar: '--signal-amber',
  },
  corroborated: {
    level: 'corroborated',
    label: 'Corroborated',
    description: (n) => `Corroborated by ${n} independent outlets.`,
    colorVar: '--verified-teal',
  },
};

/**
 * Classify by independent publisher count.
 *
 * Counts distinct publishers, not articles — two feeds from one newsroom are one
 * source. Corroboration means nothing if an outlet can corroborate itself.
 */
export function corroborationLevel(independentOutlets: number): CorroborationLevel {
  if (independentOutlets >= 3) return 'corroborated';
  if (independentOutlets >= 2) return 'confirmed';
  return 'single';
}

export function describeCorroboration(independentOutlets: number): CorroborationDescriptor {
  return CORROBORATION[corroborationLevel(independentOutlets)];
}

/** Human phrasing for an outlet count. Used wherever the number is surfaced. */
export function outletPhrase(independentOutlets: number): string {
  if (independentOutlets <= 0) return 'No sources';
  if (independentOutlets === 1) return '1 outlet';
  return `${independentOutlets} outlets`;
}

/**
 * Where an outlet count sits on a 0-1 scale, for anything that draws it.
 *
 * Logarithmic, and this is the whole point. The previous meter filled six
 * segments and stopped, so every story from six outlets to sixty rendered
 * identically — the display saturated at exactly the point where the product's
 * central claim gets strong, and a reader could not tell a well-covered story
 * from an overwhelmingly corroborated one.
 *
 * A linear scale fails the other way: sized to fit 30 outlets, the difference
 * between 1 and 2 becomes a rounding error, and 1-to-2 is the single most
 * important transition in the product — it is where "someone claimed this"
 * becomes "someone else confirmed it".
 *
 * Log spacing gives the early steps room and still separates 6 from 16. The
 * exact number is always printed alongside, so the scale only has to rank, not
 * to be read off.
 */
const SCALE_CEILING = 20;

export function corroborationScale(independentOutlets: number): number {
  const n = Math.max(independentOutlets, 1);
  if (n >= SCALE_CEILING) return 1;
  return Math.log(n) / Math.log(SCALE_CEILING);
}

/**
 * The feed's corroboration filter.
 *
 * `minSources` maps directly onto the API's `min_sources` parameter, so what the
 * reader picks and what the database filters on are the same number — there is
 * no tier lookup table in between to drift.
 */
export interface CorroborationFilter {
  id: string;
  label: string;
  minSources: number;
  hint: string;
}

export const CORROBORATION_FILTERS: CorroborationFilter[] = [
  {
    id: 'all',
    label: 'All stories',
    minSources: 1,
    hint: 'Everything on the wire, including single-source reports.',
  },
  {
    id: 'confirmed',
    label: '2+ outlets',
    minSources: 2,
    hint: 'At least one independent outlet has confirmed the story.',
  },
  {
    id: 'corroborated',
    label: '3+ outlets',
    minSources: 3,
    hint: 'Corroborated by three or more independent outlets.',
  },
];

/** Legacy tier slugs kept working as redirects to the equivalent filter. */
export const LEGACY_STATUS_TO_MIN_SOURCES: Record<string, number> = {
  wire: 1,
  developing: 2,
  corroborated: 3,
  reporting: 3,
};
