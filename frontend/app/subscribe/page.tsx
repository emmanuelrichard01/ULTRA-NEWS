"use client";

import { useState } from 'react';
import { Metadata } from 'next';

export default function SubscribePage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;

    // In production, this would POST to a backend endpoint or Mailchimp/Buttondown API
    setStatus('success');
    setEmail('');
  };

  return (
    <div className="max-w-2xl mx-auto py-16">
      {/* Header */}
      <header className="text-center mb-12">
        <span className="inline-block font-data text-[10px] font-bold uppercase tracking-widest text-[var(--verified-teal)] mb-4">
          Stay Informed
        </span>
        <h1 className="text-display-xl font-display text-[var(--foreground)] mb-4">
          The Wire Brief
        </h1>
        <p className="text-body-lg text-[var(--foreground-muted)] max-w-md mx-auto">
          A curated digest of the most corroborated stories, delivered when they matter — not on a schedule.
        </p>
      </header>

      {/* Form */}
      <div className="p-8 bg-[var(--surface-elevated)] rounded-[var(--radius-card)] border border-[var(--border)]">
        {status === 'success' ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[var(--verified-teal)] flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h2 className="text-display-md font-display text-[var(--foreground)] mb-2">
              You&apos;re on the wire.
            </h2>
            <p className="text-body-md text-[var(--foreground-muted)]">
              We&apos;ll notify you when stories break — not before.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block font-data text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="reader@example.com"
                required
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-card)] text-[var(--foreground)] text-body-md placeholder:text-[var(--foreground-muted)] focus:outline-none focus:border-[var(--verified-teal)] focus:ring-1 focus:ring-[var(--verified-teal)] transition-colors"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-[var(--foreground)] text-[var(--background)] font-data text-sm font-bold uppercase tracking-widest rounded-[var(--radius-card)] hover:opacity-90 transition-opacity duration-150"
            >
              Subscribe to The Wire Brief
            </button>

            <p className="text-center font-data text-[10px] text-[var(--foreground-muted)]">
              No spam. Unsubscribe anytime. Your data stays yours.
            </p>
          </form>
        )}
      </div>

      {/* What you get */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { title: 'Corroborated', desc: 'Only stories verified by 3+ independent sources.' },
          { title: 'Curated', desc: 'No firehose. Just the stories that matter.' },
          { title: 'Transparent', desc: 'Every claim linked to its original source.' },
        ].map((item) => (
          <div key={item.title} className="text-center p-4">
            <h3 className="font-data text-[11px] font-bold uppercase tracking-wider text-[var(--accent)] mb-2">
              {item.title}
            </h3>
            <p className="text-body-md text-[var(--foreground-muted)]">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
