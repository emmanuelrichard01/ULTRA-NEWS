import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';

/**
 * On-demand cache purge, called by the backend when a story's content changes.
 *
 * Previously this was a GET that took `?secret=` and fell back to the literal
 * default `'dev_secret'` when REVALIDATE_SECRET was unset — so on any deploy
 * that forgot the variable, anyone could purge the cache at will, and the secret
 * itself was sitting in request URLs (and therefore in access logs and
 * referrers). It is now POST-only, reads the secret from a header, and refuses
 * to run at all when unconfigured.
 */

const ALLOWED_TAG = /^story:[a-z0-9-]{1,200}$/;

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so compare lengths first.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) {
    console.error('[revalidate] REVALIDATE_SECRET is not configured; refusing request.');
    return NextResponse.json({ message: 'Not configured' }, { status: 503 });
  }

  const provided = request.headers.get('x-revalidate-secret') ?? '';
  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
  }

  let tag: unknown;
  try {
    ({ tag } = await request.json());
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  // Only story tags are purgeable — an arbitrary tag would let a caller with the
  // secret evict the entire cache.
  if (typeof tag !== 'string' || !ALLOWED_TAG.test(tag)) {
    return NextResponse.json({ message: 'Invalid tag' }, { status: 400 });
  }

  // Next 16 requires a cache-life profile alongside the tag. 'max' purges the
  // entry outright, which is what an explicit content-changed webhook wants.
  // The original call omitted this argument and suppressed the resulting type
  // error, so the signature change went unnoticed.
  revalidateTag(tag, 'max');

  return NextResponse.json({ revalidated: true, tag, now: Date.now() });
}
