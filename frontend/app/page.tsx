import Link from 'next/link';
import ArticleCard from '@/components/ArticleCard';

// Mock data for initial display
const MOCK_ARTICLES = [
  {
    title: "Django 5.0 Released",
    source: "Django Project",
    url: "https://djangoproject.com",
    published_date: new Date().toISOString(),
    category: "Tech"
  },
  {
    title: "Next.js 14 App Router Guide",
    source: "Vercel",
    url: "https://nextjs.org",
    published_date: new Date().toISOString(),
    category: "Frontend"
  },
  {
    title: "The Future of AI Agents",
    source: "DeepMind",
    url: "https://deepmind.google",
    published_date: new Date().toISOString(),
    category: "AI"
  }
];

export default function Home() {
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

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_ARTICLES.map((article, idx) => (
          <ArticleCard
            key={idx}
            title={article.title}
            source={article.source}
            url={article.url}
            published_date={article.published_date}
            category={article.category}
          />
        ))}
      </div>
    </div>
  );
}
