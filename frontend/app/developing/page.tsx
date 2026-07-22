import FeedPage from '@/components/FeedPage';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function DevelopingPage({ searchParams }: PageProps) {
  return (
    <FeedPage
      title="Developing"
      subtitle="Gaining traction. Stories confirmed by 2 independent sources."
      status="developing"
      accentColor="--signal-amber"
      pingColor="--signal-amber"
      showVelocityLeaderboard={false}
      showHero={false}
      emptyMessage="No developing stories currently."
      basePath="/developing"
      searchParams={searchParams}
    />
  );
}
