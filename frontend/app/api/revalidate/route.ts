import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag');
  const secret = request.nextUrl.searchParams.get('secret');

  const validSecret = process.env.REVALIDATE_SECRET || 'dev_secret';

  if (secret !== validSecret) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
  }

  if (!tag) {
    return NextResponse.json({ message: 'Missing tag param' }, { status: 400 });
  }

  // @ts-ignore: Next.js 16 type definitions mismatch
  revalidateTag(tag);

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
