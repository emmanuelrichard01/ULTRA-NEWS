import FeedPage from '@/components/FeedPage';

interface HomeProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Home({ searchParams }: HomeProps) {
  return (
    <FeedPage
      title="The Wire"
      subtitle="Multi-source intelligence, triangulated and verified."
      accentColor="--foreground"
      pingColor="--verified-teal"
      showVelocityLeaderboard={true}
      showHero={true}
      emptyMessage="System Offline. Connecting..."
      basePath="/"
      searchParams={searchParams}
    />
  );
}
