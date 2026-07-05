import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: "Privacy Policy | Ultra News",
    description: "Our commitment to data density and user privacy.",
};

export default function PrivacyPage() {
    return (
        <div className="max-w-3xl mx-auto pt-8 pb-20 px-4">
            <header className="mb-12 border-b border-[var(--border)] pb-8">
                <span className="text-xs font-bold tracking-widest uppercase text-[var(--accent)] mb-4 block">Ultra News</span>
                <h1 className="text-4xl md:text-5xl font-display font-[900] tracking-tighter leading-none text-[var(--foreground)] mb-6">
                    Privacy Policy
                </h1>
                <p className="font-data text-[11px] text-[var(--foreground-muted)] uppercase tracking-widest">
                    Last Updated: July 2026
                </p>
            </header>

            <div className="prose prose-lg dark:prose-invert font-serif text-[var(--foreground-muted)]">
                <p className="lead text-xl text-[var(--foreground)] font-semibold">
                    We built an intelligence terminal, not an advertising network. Our privacy policy reflects that distinction.
                </p>

                <h2 className="font-display">Zero Server-Side Tracking</h2>
                <p>
                    Ultra News does not track your reading habits on our servers. The concept of an "Intelligence Terminal" relies on absolute discretion. Any personalized curation or local state adjustments (such as dark mode preferences or local reading history) remain strictly on your device.
                </p>

                <h2 className="font-display">Data Collection</h2>
                <p>
                    As a visitor interacting with the public application, we collect standard server access logs required for security and infrastructure monitoring. These logs contain standard HTTP request data and are automatically purged. 
                </p>
                <p>
                    If you choose to use our API endpoints (e.g., via GitHub Actions OIDC), we validate the incoming JWT token solely for authorization purposes and do not store the cryptographic payload beyond the immediate transaction.
                </p>

                <h2 className="font-display">Third-Party Subprocessors</h2>
                <p>
                    Because we aggregate content from external news publishers, clicking an outbound link ("Read original source") will redirect you to third-party domains. These domains are governed by their own privacy policies. Ultra News assumes no responsibility for the tracking apparatus deployed by the original publishers.
                </p>

                <h2 className="font-display">Cookies & Local Storage</h2>
                <p>
                    We use browser `localStorage` solely for functional preferences (like your UI theme choice). We do not use third-party tracking cookies or marketing pixels.
                </p>

                <hr className="border-[var(--border)] my-12" />

                <div className="bg-[var(--surface-elevated)] p-6 rounded-[var(--radius-card)] border border-[var(--border)]">
                    <h3 className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] mb-2 mt-0">Questions?</h3>
                    <p className="text-sm m-0">
                        If you have inquiries regarding how data is managed, please review the <a href="https://github.com/emmanuelrichard01/ULTRA-NEWS" className="text-[var(--foreground)] font-semibold hover:underline">open-source repository</a> or open an issue on GitHub.
                    </p>
                </div>
            </div>
        </div>
    );
}
