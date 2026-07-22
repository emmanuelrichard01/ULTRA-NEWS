import FeedPage from '@/components/FeedPage';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ReportingPage({ searchParams }: PageProps) {
  return (
    <FeedPage
      title="Reporting"
      subtitle="Verified intelligence corroborated by 3 or more independent sources."
      status="corroborated"
      accentColor="--verified-teal"
      pingColor="--verified-teal"
      showVelocityLeaderboard={false}
      showHero={false}
      emptyMessage="No corroborated stories currently. Stories reach this tier when 3+ independent outlets confirm coverage."
      basePath="/reporting"
      searchParams={searchParams}
    />
  );
}
