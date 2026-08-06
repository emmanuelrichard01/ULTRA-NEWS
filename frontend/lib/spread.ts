/**
 * Coverage spread — how long a story took to accumulate its outlets.
 *
 * This is the distinction the project's own README leads with and that the
 * interface has never shown:
 *
 *   "Six outlets publishing within twenty minutes is consistent with one wire
 *    feeding everyone. Six over nine hours suggests newsrooms working
 *    separately. Both read as 'six outlets' on a counter alone."
 *
 * A corroboration count answers "how many". It cannot answer "independently?",
 * and that second question is the one that decides whether the count means
 * anything. The story page shows the shape of the pickup; every list in the
 * product showed the bare number, which is precisely the failure mode the
 * README describes.
 *
 * The span is a plain subtraction of two timestamps already on every story, so
 * it costs nothing and invents nothing.
 */

export interface Spread {
  /** Hours between the first article and the most recent one. */
  hours: number;
  /** Compact human form: "40m", "6h", "3d". */
  label: string;
  /**
   * A description, never a verdict.
   *
   * "Consistent with a single wire" is as far as this goes, and it is the
   * README's own wording. Ten outlets republishing one agency report inside
   * half an hour is *consistent with* syndication; it is not proof of it, and
   * a product whose whole argument is "show the evidence, not a score" has no
   * business printing a confidence label here.
   */
  note: 'tight' | 'sustained' | null;
}

const TIGHT_HOURS = 1.5;
const SUSTAINED_HOURS = 8;
/** Below this, a tight window says nothing — two outlets often just coincide. */
const MIN_OUTLETS_FOR_NOTE = 4;

export function coverageSpread(
  firstSeenAt: string,
  lastUpdatedAt: string,
  independentOutlets: number
): Spread {
  const ms =
    new Date(lastUpdatedAt).getTime() - new Date(firstSeenAt).getTime();
  const hours = Math.max(ms, 0) / 3_600_000;

  let note: Spread['note'] = null;
  if (independentOutlets >= MIN_OUTLETS_FOR_NOTE) {
    if (hours > 0 && hours <= TIGHT_HOURS) note = 'tight';
    else if (hours >= SUSTAINED_HOURS) note = 'sustained';
  }

  return { hours, label: durationLabel(hours), note };
}

/** Compact duration, matching the feed's "10h ago" register. */
export function durationLabel(hours: number): string {
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `${minutes}m`;
  }
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Hours since an instant, for "how long has this stood alone". */
export function hoursSince(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
}
