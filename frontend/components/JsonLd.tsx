import { absoluteUrl } from '@/lib/site';

/**
 * Structured data, safely serialised.
 *
 * Story pages embed publisher headlines — text from RSS feeds nobody here
 * controls — inside a <script> element. `JSON.stringify` does not escape `<`,
 * so a headline containing `</script>` would close the element early and turn
 * the rest into live markup. Escaping `<`, `>` and `&` as \u sequences keeps
 * the JSON identical to a parser and inert to the HTML tokenizer.
 */
export default function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/** A BreadcrumbList from [name, path] pairs, home first. */
export function breadcrumbList(trail: [string, string][]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: absoluteUrl(path),
    })),
  };
}
