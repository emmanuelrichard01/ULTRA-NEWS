import Link from 'next/link';

interface ArticleProps {
    title: string;
    source: string;
    url: string;
    published_date: string;
    category?: string;
}

export default function ArticleCard({ title, source, url, published_date, category }: ArticleProps) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col h-full">
            <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-2">
                    {category && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {category}
                        </span>
                    )}
                    <span className="text-xs text-gray-500">{new Date(published_date).toLocaleDateString()}</span>
                </div>
                <a href={url} target="_blank" rel="noopener noreferrer" className="block group">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 line-clamp-2 mb-2">
                        {title}
                    </h3>
                </a>
                <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                    {/* Content preview could go here if available */}
                </p>
            </div>
            <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{source}</span>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                    Read more &rarr;
                </a>
            </div>
        </div>
    );
}
