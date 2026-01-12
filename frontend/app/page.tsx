import Link from 'next/link';
import ArticleCard from '@/components/ArticleCard';

async function getArticles() {
  // Use http://backend:8000 internally within Docker network
  // But for SSR on dev machine it might need localhost if not running in container...
  // Actually, Next.js generic fetch is server-side.
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';

  try {
    const res = await fetch(`${API_URL}/api/news`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('Failed to fetch data');
    }
    return res.json();
  } catch (error) {
    console.error("Error fetching articles:", error);
    return [];
  }
}

export default async function Home() {
  const articles = await getArticles();

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
          <span className="block xl:inline">Latest Headlines from</span>{' '}
          <span className="block text-blue-600 xl:inline">Ultra News</span>
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          Your daily dose of aggregated news from the best sources around the web.
          Powered by Django Ninja and Next.js.
        </p>
      </div>

      {articles.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          <p>No articles found. Run the ingestion command to populate data.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article: any, idx: number) => (
            <ArticleCard
              key={idx}
              title={article.title}
              source={article.source.name}
              url={article.url}
              published_date={article.published_date}
              category="General"
            />
          ))}
        </div>
      )}
    </div>
  );
}
