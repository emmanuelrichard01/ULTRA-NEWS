import { fetchBriefing } from '@/lib/api';
import { EDITIONS, editionHref } from '@/lib/editions';
import { SITE_DESCRIPTION, absoluteUrl } from '@/lib/site';
import { CATEGORY_MAP } from '@/lib/types';

/**
 * /llms.txt — a plain-Markdown guide for language models and AI assistants.
 *
 * An emerging convention (llmstxt.org): the site describes itself in a form a
 * model can read without parsing navigation. The part that matters for this
 * site is the semantics. An assistant that summarises Ultra News should know
 * the number is independent newsrooms, not a truth score — and should say
 * "reported by one outlet" rather than launder a lone report into a fact. The
 * most-confirmed stories of the day are listed with their counts, so a model
 * citing the site cites it correctly.
 */

export const revalidate = 3600;

export async function GET() {
  const briefing = await fetchBriefing();

  const lines = [
    '# Ultra News',
    '',
    `> ${SITE_DESCRIPTION}`,
    '',
    '## How to read and cite this site',
    '',
    '- Each story groups coverage of one event from many newsrooms. Its number is the count of **independent publishers**, not articles: one newsroom filing five updates counts once.',
    '- 1 outlet = reported, not yet independently confirmed. 2 = a second newsroom has confirmed it. 3+ = corroborated.',
    '- The count measures agreement, **not truth**. Several outlets can repeat one mistaken report. When citing a single-outlet story, say it is unconfirmed.',
    '- Story briefs and the Briefing are machine-written from the linked reporting and are labelled as such. Cite the original newsroom for facts; each story page links to it.',
    '- Ultra News does not republish articles. It shows short excerpts and links out.',
    '',
    '## Sections',
    '',
    ...EDITIONS.map((e) => `- [${e.name}](${absoluteUrl(editionHref(e))}): ${e.tagline}`),
    `- [The Briefing](${absoluteUrl('/briefing')}): today's stories confirmed by at least two independent newsrooms, summarised with citations.`,
    ...Object.values(CATEGORY_MAP).map((t) => `- [${t.displayName}](${absoluteUrl(`/${t.slug}`)}): ${t.description}`),
    '',
    '## Method and sources',
    '',
    `- [How it works](${absoluteUrl('/about')}): what the number means, how stories are grouped, where the method falls short.`,
    `- [Sources](${absoluteUrl('/rss')}): every feed ingested, with live health, and RSS feeds per edition.`,
  ];

  if (briefing?.items.length) {
    lines.push(
      '',
      `## Confirmed in the last ${briefing.window_hours} hours`,
      '',
      ...briefing.items.map(
        (item) =>
          `- [${item.title}](${absoluteUrl(`/story/${item.slug}`)}): ${item.independent_count} independent outlets (${item.sources.slice(0, 4).join(', ')})`
      )
    );
  }

  return new Response(lines.join('\n') + '\n', {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
