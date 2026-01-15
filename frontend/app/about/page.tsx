
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
                <h1 className="text-6xl md:text-8xl font-[900] tracking-tighter leading-none text-[var(--foreground)] mb-6 font-display uppercase">
                    About
                </h1>
                <p className="text-xl md:text-2xl font-serif text-[var(--foreground-muted)] max-w-2xl leading-relaxed">
                    Ultra News is an <span className="text-[var(--foreground)] font-semibold">Information Instrument</span> engineered for clarity, density, and speed.
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
                            <div className="flex gap-6">
                                <a
                                    href="https://github.com/emmanuelrichard01"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--foreground)] border-b-2 border-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all px-1"
                                >
                                    GitHub Profile ↗
                                </a>
                                <a
                                    href="mailto:contact@ultranews.demo"
                                    className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all"
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
