import { absoluteUrl } from '@/lib/site';

/**
 * RFC 9116 security.txt — where to report a vulnerability.
 *
 * Reports go to GitHub's private vulnerability reporting for the repository,
 * so they are not filed as public issues. `Expires` is required and must be
 * under a year out; generating it keeps it from lapsing silently.
 */

export const revalidate = 86400;

export function GET() {
  const expires = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();
  const body = [
    'Contact: https://github.com/emmanuelrichard01/ULTRA-NEWS/security/advisories/new',
    `Expires: ${expires}`,
    'Preferred-Languages: en',
    `Canonical: ${absoluteUrl('/.well-known/security.txt')}`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
