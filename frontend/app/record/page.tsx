import type { Metadata } from 'next';

import FeedPage from '@/components/FeedPage';
import { EDITIONS_BY_SLUG } from '@/lib/editions';

const edition = EDITIONS_BY_SLUG['record'];

export const metadata: Metadata = {
  title: edition.name,
  description: edition.tagline,
};

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RecordPage({ searchParams }: PageProps) {
  return <FeedPage edition={edition} searchParams={searchParams} />;
}
