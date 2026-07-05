
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: "About | Ultra News",
    description: "The story of Ultra News: From a diploma project to a high-performance information instrument.",
};

export default function AboutPage() {
    return (
        <div className="max-w-3xl mx-auto pt-8 pb-20 px-4">
            {/* Editorial Header */}
            <header className="mb-16 border-b border-[var(--border)] pb-8">
                <span className="text-xs font-bold tracking-widest uppercase text-[var(--accent-secondary)] mb-4 block">About Ultra News</span>
                <h1 className="text-5xl md:text-7xl font-[900] tracking-tighter leading-none text-[var(--foreground)] mb-6 font-display">
                    The Information Instrument
                </h1>
                <p className="text-xl md:text-2xl font-serif text-[var(--foreground-muted)] max-w-2xl leading-relaxed">
                    Engineered for <span className="text-[var(--foreground)] font-semibold">clarity</span>, <span className="text-[var(--foreground)] font-semibold">density</span>, and <span className="text-[var(--foreground)] font-semibold">speed</span>.
                </p>
            </header>

            <div className="space-y-20">

                {/* Section 1: The Platform */}
                <section>
                    <span className="text-xs font-bold tracking-widest uppercase text-[var(--accent)] mb-4 block">The Platform</span>
                    <h2 className="text-3xl font-display font-bold mb-6 text-[var(--foreground)]">The Problem with News</h2>
                    <div className="prose prose-lg dark:prose-invert text-[var(--foreground-muted)] font-serif">
                        <p>
                            The modern web is suffering from <strong>information overload</strong>. News aggregators today are cluttered with cards, infinite scrolls, invasive ads, and algorithmic noise. They are designed for engagement, not enlightenment.
                        </p>
                        <p>
                            Ultra News takes the opposite approach. We believe in <strong>Information Density</strong> without cognitive fatigue. Our interface is stripped back to the raw essentials: high-contrast typography, zero-friction navigation, and curated intelligence. It’s not just a feed; it’s a tool for the accelerated mind.
                        </p>
                    </div>
                </section>

                {/* Section 2: History */}
                <section className="grid md:grid-cols-2 gap-12 items-start">
                    <div>
                        <span className="text-xs font-bold tracking-widest uppercase text-[var(--accent)] mb-4 block">The Origin Story</span>
                        <h2 className="text-3xl font-display font-bold mb-6 text-[var(--foreground)]">From 2020 to Now</h2>
                        <div className="prose prose-lg dark:prose-invert text-[var(--foreground-muted)] font-serif">
                            <p>
                                Ultra News began in 2020 as a humble diploma project. Back then, it was a simple experiment in web scraping—a proof of concept to see if I could centralize information from my favorite tech blogs.
                            </p>
                            <p>
                                But the vision never died. In 2024, I rebuilt it from the ground up. This isn't just a refactor; it's a complete reimagining. We moved from a monolithic script to a <strong>Docker-native, split-stack architecture</strong> using Next.js 16 and Django 5. We replaced basic scraping with a browser-grade ingestion engine capable of deep-fetching full articles and high-res imagery.
                            </p>
                        </div>
                    </div>
                    <div className="bg-[var(--surface-elevated)] p-8 rounded-[var(--radius-card)] border border-[var(--border)] relative overflow-hidden group">
                        {/* Decorative wireframe grid background */}
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMTI4LDEyOCwxMjgsMC4xKSIvPjwvc3ZnPg==')] opacity-50"></div>

                        <div className="relative z-10">
                            <h3 className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] mb-6 flex items-center gap-2">
                                Evolution Log
                            </h3>
                            <ul className="space-y-5 font-mono text-[13px] leading-relaxed">
                                <li className="flex gap-4 items-start">
                                    <span className="text-[var(--foreground-muted)] opacity-60 mt-0.5">2020</span>
                                    <span className="text-[var(--foreground-muted)]">Initial Prototype<br /><span className="text-[11px] opacity-70">PHP / MySQL</span></span>
                                </li>
                                <li className="flex gap-4 items-start">
                                    <span className="text-[var(--foreground-muted)] opacity-60 mt-0.5">2022</span>
                                    <span className="text-[var(--foreground-muted)]">Migration to local scripts<br /><span className="text-[11px] opacity-70">Python</span></span>
                                </li>
                                <li className="flex gap-4 items-start">
                                    <span className="text-[var(--foreground-muted)] opacity-60 mt-0.5">2024</span>
                                    <span className="text-[var(--foreground-muted)]">Ultra News V2<br /><span className="text-[11px] opacity-70">Basic Cloud Production</span></span>
                                </li>
                                <li className="flex gap-4 items-start">
                                    <span className="text-[var(--foreground)] font-bold mt-0.5">2025</span>
                                    <div>
                                        <span className="text-[var(--accent)] font-bold uppercase tracking-widest text-[12px] block mb-2">V3 — The Wire Room</span>
                                        <div className="pl-3 border-l-2 border-[var(--border)] space-y-2 text-[12px] text-[var(--foreground)]">
                                            <p><span className="text-[var(--accent)] font-bold">»</span> Semantic Vector Clustering (pgvector + fastembed)</p>
                                            <p><span className="text-[var(--accent)] font-bold">»</span> The Trust Graph (Reputation Engine)</p>
                                            <p><span className="text-[var(--accent)] font-bold">»</span> Next.js 16 + Django Ninja Architecture</p>
                                            <p><span className="text-[var(--accent)] font-bold">»</span> Real-time Coverage Velocity Analytics</p>
                                        </div>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Section 3: The Builder */}
                <section className="border-t border-[var(--border)] pt-20">
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className="flex-1">
                            <span className="text-xs font-bold tracking-widest uppercase text-[var(--accent)] mb-4 block">The Builder</span>
                            <h2 className="text-4xl font-display font-black mb-6 text-[var(--foreground)]">Emmanuel Richard Moghalu</h2>
                            <div className="prose prose-lg dark:prose-invert text-[var(--foreground-muted)] font-serif mb-8">
                                <p>
                                    I am a full-stack engineer passionate about building high-performance systems and clean, utility-first user interfaces. Ultra News is the culmination of my journey—combining rigorous backend engineering with editorial design principles.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                <a
                                    href="https://github.com/emmanuelrichard01"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-[var(--radius-chip)] hover:opacity-90 transition-opacity"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                                    GitHub
                                </a>
                                <a
                                    href="https://x.com/mrebr"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--foreground-muted)] border border-[var(--border)] px-4 py-2 rounded-[var(--radius-chip)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-all"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" /></svg>
                                    X / Twitter
                                </a>
                                <a
                                    href="https://www.linkedin.com/in/e-mc/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--foreground-muted)] border border-[var(--border)] px-4 py-2 rounded-[var(--radius-chip)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-all"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                                    LinkedIn
                                </a>
                            </div>
                        </div>
                        {/* Optional: Add a profile picture if available, otherwise using abstract initial */}
                        <div className="w-32 h-32 bg-[var(--foreground)] flex items-center justify-center flex-shrink-0">
                            <span className="text-[var(--background)] font-display text-4xl font-black">EM</span>
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
}
