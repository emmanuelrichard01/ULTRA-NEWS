import Link from 'next/link';

interface TrendingStory {
  id: number;
  title: string;
  slug: string;
  velocity_score: number;
  source_count: number;
  status: string;
}

export default function VelocityLeaderboard({ stories }: { stories: TrendingStory[] }) {
  if (!stories || stories.length === 0) return null;

  // Take top 5 developing stories
  const trending = stories
    .filter(s => s.status === 'developing' || s.status === 'corroborated')
    .sort((a, b) => b.velocity_score - a.velocity_score)
    .slice(0, 5);

  if (trending.length === 0) return null;

  return (
    <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-card)] p-4 md:p-6 mb-12 relative overflow-hidden">
      {/* Decorative top pulse */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-50"></div>
      
      <h2 className="font-data text-[11px] font-bold uppercase tracking-widest text-[var(--accent)] mb-5 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]"></span>
        </span>
        Coverage Velocity Leaderboard
      </h2>
      
      <div className="space-y-4">
        {trending.map((story, idx) => (
          <Link 
            key={story.slug} 
            href={`/story/${story.slug}`}
            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-[var(--radius-chip)] hover:bg-[var(--surface)] transition-colors"
          >
            <div className="flex items-start gap-4">
              <span className="font-data text-[14px] font-bold text-[var(--foreground-muted)] opacity-50 pt-0.5">
                0{idx + 1}
              </span>
              <div>
                <h3 className="font-display text-[15px] text-[var(--foreground)] leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2">
                  {story.title}
                </h3>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              {/* Velocity Bar visualization */}
              <div className="hidden sm:flex items-center gap-[2px]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-1.5 rounded-full transition-all ${
                      i < Math.min(5, Math.ceil(story.velocity_score)) 
                        ? 'bg-[var(--accent)] h-4' 
                        : 'bg-[var(--border)] h-2'
                    }`} 
                  />
                ))}
              </div>
              
              <div className="text-right">
                <span className="block font-data text-[12px] font-bold text-[var(--foreground)]">
                  {story.velocity_score.toFixed(1)} <span className="opacity-60 font-normal">v/hr</span>
                </span>
                <span className="block font-data text-[9px] text-[var(--foreground-muted)] uppercase tracking-wider">
                  {story.source_count} Sources
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
