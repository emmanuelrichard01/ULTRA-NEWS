/**
 * SourceChain — who broke the story, and who followed.
 *
 * The API returns `sources` deduplicated by publisher and ordered
 * oldest-first: `_card_articles` sorts on (story, published_date, id) and keeps
 * the first row per outlet, so `sources[0]` is the newsroom that filed first
 * and the rest are in the order they picked it up.
 *
 * That ordering was being thrown away. The card rendered
 * `sources.slice(0, 3).join(' · ')` as an anonymous grey run of names, which
 * reads as a list of tags — nothing signalled that the sequence carried
 * information, so nobody could learn it did. "Who broke it, and who followed"
 * is one of the four things the project's own README says the product is for,
 * and on the feed it was invisible.
 *
 * Naming the first outlet is also the honest way to present a corroboration
 * count. "9 outlets" invites the reading that nine newsrooms independently
 * established something; often eight of them are following one. Saying who was
 * first, and that the others came after, describes what actually happened.
 *
 * The count of followers comes from `independent_count`, not from the length of
 * this array: the API caps `sources` at five, so deriving "+N more" from the
 * array meant a story carried by twenty outlets and one carried by five both
 * reported the same followers.
 */

interface SourceChainProps {
  /** Publishers, oldest-first, as returned by the API. */
  sources: string[];
  /** True total of independent publishers, which may exceed `sources`. */
  independentCount: number;
  variant?: 'lead' | 'inline';
  className?: string;
}

export default function SourceChain({
  sources,
  independentCount,
  variant = 'inline',
  className = '',
}: SourceChainProps) {
  if (sources.length === 0) return null;

  const [first, ...followers] = sources;
  const total = Math.max(independentCount, sources.length);
  const followerCount = total - 1;

  // ------------------------------------------------------------- inline
  //
  // One line for list rows. The first outlet carries the emphasis; the rest are
  // a count rather than a list, because in a feed the reader is deciding
  // whether to open the story, not auditing it.
  if (variant === 'inline') {
    return (
      <p
        className={`font-data min-w-0 truncate text-[11px] text-[var(--foreground-subtle)] ${className}`}
      >
        <span className="text-[var(--foreground-muted)]">{first}</span>
        {followerCount > 0 ? (
          <>
            {' broke it · '}
            {followerCount} {followerCount === 1 ? 'outlet' : 'outlets'} followed
          </>
        ) : (
          ' · sole source'
        )}
      </p>
    );
  }

  // --------------------------------------------------------------- lead
  //
  // The hero has room to show the sequence itself rather than summarise it.
  return (
    <div className={`flex flex-wrap items-baseline gap-x-2.5 gap-y-1 ${className}`}>
      <span className="text-label text-[var(--foreground-subtle)]">Broke it</span>
      <span className="font-data text-[12px] font-semibold text-[var(--foreground)]">
        {first}
      </span>

      {followers.length > 0 && (
        <>
          <span aria-hidden="true" className="text-[var(--border-strong)]">
            →
          </span>
          <span className="text-label text-[var(--foreground-subtle)]">
            then
          </span>
          <span className="font-data text-[12px] text-[var(--foreground-muted)]">
            {followers.join(' · ')}
            {total > sources.length && (
              <span className="text-[var(--foreground-subtle)]">
                {' '}
                +{total - sources.length} more
              </span>
            )}
          </span>
        </>
      )}
    </div>
  );
}
