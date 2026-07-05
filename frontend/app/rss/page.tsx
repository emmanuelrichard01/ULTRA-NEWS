import { Metadata } from 'next';

export const metadata: Metadata = {
    title: "RSS Data Streams | Ultra News",
    description: "Inbound and outbound data stream parameters for the Ultra News Terminal.",
};

const INBOUND_SOURCES = [
    { name: "The Verge", topic: "Technology", url: "https://www.theverge.com/rss/index.xml" },
    { name: "Wired", topic: "Technology", url: "https://www.wired.com/feed/rss" },
    { name: "TechCrunch", topic: "Technology", url: "https://techcrunch.com/feed/" },
    { name: "Ars Technica", topic: "Technology", url: "https://arstechnica.com/feed/" },
    { name: "Premium Times", topic: "Africa", url: "https://www.premiumtimesng.com/feed" },
    { name: "BusinessDay", topic: "Africa", url: "https://businessday.ng/feed/" },
];

const OUTBOUND_FEEDS = [
    { name: "The Wire Feed", desc: "Firehose of all raw inbound stories.", endpoint: "/api/v1/feeds/wire.xml" },
    { name: "Developing Feed", desc: "Stories hitting traction velocity (>1 source).", endpoint: "/api/v1/feeds/developing.xml" },
    { name: "Reporting Feed", desc: "Fully corroborated stories (>3 independent domains).", endpoint: "/api/v1/feeds/reporting.xml" },
];

export default function RssPage() {
    return (
        <div className="max-w-4xl mx-auto pt-8 pb-20 px-4">
            <header className="mb-12 border-b border-[var(--border)] pb-8">
                <span className="text-xs font-bold tracking-widest uppercase text-[var(--accent)] mb-4 block">System Architecture</span>
                <h1 className="text-4xl md:text-5xl font-display font-[900] tracking-tighter leading-none text-[var(--foreground)] mb-6">
                    RSS Data Streams
                </h1>
                <p className="font-serif text-[18px] text-[var(--foreground-muted)] max-w-2xl leading-relaxed">
                    Ultra News is fundamentally an aggregation engine. Below are the parameters for our inbound collection arrays and our outbound syndicated intelligence feeds.
                </p>
            </header>

            {/* Outbound Subscriptions */}
            <section className="mb-16">
                <h2 className="font-data text-[12px] font-bold uppercase tracking-widest text-[var(--foreground)] mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--verified-teal)]"></span>
                    Outbound Subscriptions (Phase 4 Draft)
                </h2>
                <div className="grid md:grid-cols-3 gap-6">
                    {OUTBOUND_FEEDS.map(feed => (
                        <div key={feed.name} className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-card)] p-5 relative group overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--border)] group-hover:bg-[var(--verified-teal)] transition-colors"></div>
                            <h3 className="font-display font-bold text-[16px] text-[var(--foreground)] mb-2 mt-2">{feed.name}</h3>
                            <p className="font-serif text-[13px] text-[var(--foreground-muted)] mb-6">{feed.desc}</p>
                            
                            <div className="bg-[var(--background)] px-3 py-2 rounded-[var(--radius-chip)] border border-[var(--border)]">
                                <code className="font-data text-[10px] text-[var(--foreground)] truncate block select-all">
                                    {feed.endpoint}
                                </code>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Inbound Intercepts */}
            <section>
                <h2 className="font-data text-[12px] font-bold uppercase tracking-widest text-[var(--foreground)] mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--signal-amber)]"></span>
                    Inbound Intercepts
                </h2>
                <div className="bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left font-data text-[12px]">
                            <thead className="bg-[var(--surface-elevated)] text-[var(--foreground-muted)] border-b border-[var(--border)]">
                                <tr>
                                    <th className="p-4 font-normal uppercase tracking-wider">Source Target</th>
                                    <th className="p-4 font-normal uppercase tracking-wider">Classification</th>
                                    <th className="p-4 font-normal uppercase tracking-wider">Stream URI</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                                {INBOUND_SOURCES.map((source, idx) => (
                                    <tr key={idx} className="hover:bg-[var(--surface-elevated)] transition-colors">
                                        <td className="p-4 font-bold">{source.name}</td>
                                        <td className="p-4">
                                            <span className="bg-[var(--border)] px-2 py-1 rounded-[var(--radius-chip)] text-[10px]">
                                                {source.topic}
                                            </span>
                                        </td>
                                        <td className="p-4 text-[var(--foreground-muted)] select-all font-mono">
                                            {source.url}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}
