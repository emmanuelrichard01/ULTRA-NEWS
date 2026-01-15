
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
                    <div className="bg-[var(--background-elevated)] p-8 rounded-lg border border-[var(--border)]">
                        <h3 className="text-sm font-bold uppercase tracking-widest mb-4">The Evolution</h3>
                        <ul className="space-y-4 text-sm font-mono">
                            <li className="flex gap-4">
                                <span className="text-[var(--foreground-muted)]">2020</span>
                                <span>Initial Prototype (PHP/MySQL)</span>
                            </li>
                            <li className="flex gap-4">
                                <span className="text-[var(--foreground-muted)]">2022</span>
                                <span>Migration to simple Python scripts</span>
                            </li>
                            <li className="flex gap-4">
                                <span className="text-[var(--accent)] font-bold">2024</span>
                                <span><strong>Ultra News V2 (Production)</strong></span>
                            </li>
                            <li className="pl-[3.5rem] opacity-70 border-l border-[var(--border)] ml-1">Next.js App Router (Frontend)</li>
                            <li className="pl-[3.5rem] opacity-70 border-l border-[var(--border)] ml-1">Django Ninja API (Backend)</li>
                            <li className="pl-[3.5rem] opacity-70 border-l border-[var(--border)] ml-1">PostgreSQL + Vector Search</li>
                            <li className="pl-[3.5rem] opacity-70 border-l border-[var(--border)] ml-1">Redis Caching & Queues</li>
                        </ul>
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
                                    className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                                    GitHub Profile
                                </a>
                                <a
                                    href="mailto:contact@ultranews.demo"
                                    className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--foreground-muted)] border border-[var(--border)] px-4 py-2 rounded-md hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-all"
                                >
                                    Contact Me
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
