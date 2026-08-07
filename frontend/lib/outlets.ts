import type { StoryArticle } from './types';

/**
 * Grouping articles by the newsroom that published them.
 *
 * The single rule this product rests on is that a newsroom cannot corroborate
 * itself, so every count of "independent outlets" must be taken over
 * PUBLISHERS, not over feed names. Those are not the same thing: "BBC News" and
 * "BBC World" are two feeds and one newsroom.
 *
 * Three components on the story page each grouped articles their own way, all
 * of them on `source.name`. The result was a page whose masthead read
 * "Corroborated by 16 independent outlets" — from the backend, correctly
 * computed over publisher domains — directly above a timeline headed "17
 * independent outlets", counted from the same articles the wrong way. Two
 * numbers for one fact, on the page built to demonstrate the rule that produces
 * it.
 *
 * So the grouping lives here, once, and returns the feeds it merged so the UI
 * can be explicit about it rather than silently dropping a row.
 */

export interface OutletGroup {
  /** Publisher key — what independence is counted in. */
  publisher: string;
  /** Display name: the feed that published first. */
  name: string;
  /** All feed names under this publisher, e.g. ["BBC News", "BBC World"]. */
  feedNames: string[];
  /** This publisher's earliest article — its own first take on the story. */
  first: StoryArticle;
  /** Every article from this publisher, oldest first. */
  articles: StoryArticle[];
  firstPublishedAt: Date;
}

/** The key a story's articles must be grouped on. */
export function publisherKey(article: StoryArticle): string {
  return article.source.publisher ?? article.source.name;
}

/**
 * One entry per newsroom, ordered by when that newsroom first published.
 *
 * Ordering by first publication is what makes the result a corroboration
 * sequence rather than a list: entry zero broke the story and the rest followed
 * in order, which is the shape every timeline on the page needs.
 */
export function groupByOutlet(articles: StoryArticle[]): OutletGroup[] {
  const chronological = [...articles].sort(
    (a, b) =>
      new Date(a.published_date).getTime() - new Date(b.published_date).getTime()
  );

  const groups = new Map<string, OutletGroup>();

  for (const article of chronological) {
    const key = publisherKey(article);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        publisher: key,
        name: article.source.name,
        feedNames: [article.source.name],
        first: article,
        articles: [article],
        firstPublishedAt: new Date(article.published_date),
      });
      continue;
    }

    existing.articles.push(article);
    if (!existing.feedNames.includes(article.source.name)) {
      existing.feedNames.push(article.source.name);
    }
  }

  return [...groups.values()].sort(
    (a, b) => a.firstPublishedAt.getTime() - b.firstPublishedAt.getTime()
  );
}

/**
 * How many separate feeds were merged away.
 *
 * Worth surfacing rather than hiding: "18 feeds from 16 newsrooms" is the rule
 * doing its job in front of the reader, and it is more persuasive than the
 * count on its own.
 */
export function mergedFeedCount(groups: OutletGroup[]): number {
  return groups.reduce((n, g) => n + Math.max(g.feedNames.length - 1, 0), 0);
}
