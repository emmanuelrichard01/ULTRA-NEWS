import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Privacy Policy | Ultra News",
  description: "How Ultra News handles data, cookies, and third-party services — with full transparency.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto pt-8 pb-20 px-4">
      <header className="mb-12 border-b-2 border-[var(--foreground)] pb-8">
        <span className="text-xs font-bold tracking-widest uppercase text-[var(--accent)] mb-4 block">Ultra News</span>
        <h1 className="text-4xl md:text-5xl font-display font-[900] tracking-tighter leading-none text-[var(--foreground)] mb-6">
          Privacy Policy
        </h1>
        <p className="font-data text-[11px] text-[var(--foreground-muted)] uppercase tracking-widest">
          Last Updated: July 2026
        </p>
      </header>

      {/* Quick nav */}
      <nav className="mb-12 p-4 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-card)]">
        <span className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] block mb-3">Sections</span>
        <div className="flex flex-wrap gap-2">
          {['Overview', 'Data Collection', 'Cookies & Storage', 'Third-Party Services', 'Data Retention', 'Your Rights', 'Contact'].map((section, i) => (
            <a
              key={section}
              href={`#section-${i + 1}`}
              className="font-data text-[11px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors px-2 py-1 bg-[var(--background)] border border-[var(--border)] rounded-sm"
            >
              §{i + 1} {section}
            </a>
          ))}
        </div>
      </nav>

      <div className="space-y-12">
        <p className="text-xl text-[var(--foreground)] font-serif font-semibold leading-relaxed">
          We built an intelligence terminal, not an advertising network. Our privacy policy reflects that distinction.
        </p>

        {/* Data Flow Diagram */}
        <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-card)] p-6">
          <span className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] block mb-4">Data Flow</span>
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {[
              { label: 'You', sublabel: 'Browser', color: 'var(--foreground)' },
              { label: 'Next.js', sublabel: 'SSR / ISR', color: 'var(--accent)' },
              { label: 'Django API', sublabel: 'Stateless', color: 'var(--signal-amber)' },
              { label: 'PostgreSQL', sublabel: 'News data only', color: 'var(--verified-teal)' },
            ].map((node, i) => (
              <div key={node.label} className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-1 min-w-[80px]">
                  <div className="w-14 h-14 rounded-lg border-2 flex items-center justify-center" style={{ borderColor: node.color }}>
                    <span className="font-data text-[10px] font-bold text-center" style={{ color: node.color }}>{node.label}</span>
                  </div>
                  <span className="font-data text-[8px] text-[var(--foreground-muted)] uppercase tracking-wider">{node.sublabel}</span>
                </div>
                {i < 3 && (
                  <svg width="20" height="12" viewBox="0 0 20 12" fill="none" className="shrink-0 text-[var(--foreground-muted)] opacity-40">
                    <path d="M0 6H18M18 6L13 1M18 6L13 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            ))}
          </div>
          <p className="font-data text-[10px] text-[var(--foreground-muted)] mt-4 border-t border-[var(--border)] pt-3">
            No user data is stored in any database. PostgreSQL contains only ingested news articles and source metadata.
          </p>
        </div>

        {/* §1 Overview */}
        <section id="section-1">
          <h2 className="font-display text-2xl font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <span className="font-data text-[12px] text-[var(--accent)]">§1</span>
            Zero Server-Side Tracking
          </h2>
          <div className="font-serif text-[var(--foreground-muted)] space-y-4 leading-relaxed">
            <p>
              Ultra News does not track your reading habits on our servers. The concept of an &ldquo;Intelligence Terminal&rdquo; relies on absolute discretion. Any personalized curation or local state adjustments (such as dark mode preferences or local reading history) remain strictly on your device.
            </p>
            <p>
              We do not operate user accounts, login systems, or behavioral analytics. There is no user database, no session tracking, and no profiling of any kind.
            </p>
          </div>
        </section>

        {/* §2 Data Collection */}
        <section id="section-2">
          <h2 className="font-display text-2xl font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <span className="font-data text-[12px] text-[var(--accent)]">§2</span>
            Data Collection
          </h2>
          <div className="font-serif text-[var(--foreground-muted)] space-y-4 leading-relaxed">
            <p>
              As a visitor interacting with the public application, we collect standard server access logs required for security and infrastructure monitoring. These logs contain standard HTTP request data (IP address, user agent, timestamp, request path) and are automatically purged.
            </p>
            <p>
              If you choose to use our API endpoints (e.g., via GitHub Actions OIDC), we validate the incoming JWT token solely for authorization purposes and do not store the cryptographic payload beyond the immediate transaction.
            </p>
          </div>
        </section>

        {/* §3 Cookies & Storage */}
        <section id="section-3">
          <h2 className="font-display text-2xl font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <span className="font-data text-[12px] text-[var(--accent)]">§3</span>
            Cookies &amp; Local Storage
          </h2>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-left font-data text-[12px] border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden">
              <thead className="bg-[var(--surface-elevated)] text-[var(--foreground-muted)]">
                <tr>
                  <th className="p-3 font-normal uppercase tracking-wider text-[10px]">Key</th>
                  <th className="p-3 font-normal uppercase tracking-wider text-[10px]">Storage</th>
                  <th className="p-3 font-normal uppercase tracking-wider text-[10px]">Purpose</th>
                  <th className="p-3 font-normal uppercase tracking-wider text-[10px]">Retention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                <tr>
                  <td className="p-3 font-mono text-[11px]">theme</td>
                  <td className="p-3">localStorage</td>
                  <td className="p-3 text-[var(--foreground-muted)]">Dark/light mode preference</td>
                  <td className="p-3 text-[var(--foreground-muted)]">Persistent (until cleared)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="font-serif text-[var(--foreground-muted)] leading-relaxed">
            We do not use third-party tracking cookies, marketing pixels, or advertising identifiers. The single localStorage entry above is the complete inventory.
          </p>
        </section>

        {/* §4 Third-Party Services */}
        <section id="section-4">
          <h2 className="font-display text-2xl font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <span className="font-data text-[12px] text-[var(--accent)]">§4</span>
            Third-Party Services
          </h2>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-left font-data text-[12px] border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden">
              <thead className="bg-[var(--surface-elevated)] text-[var(--foreground-muted)]">
                <tr>
                  <th className="p-3 font-normal uppercase tracking-wider text-[10px]">Service</th>
                  <th className="p-3 font-normal uppercase tracking-wider text-[10px]">Purpose</th>
                  <th className="p-3 font-normal uppercase tracking-wider text-[10px]">Data Shared</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                <tr>
                  <td className="p-3 font-bold">Vercel</td>
                  <td className="p-3 text-[var(--foreground-muted)]">Hosting & edge delivery</td>
                  <td className="p-3 text-[var(--foreground-muted)]">Anonymized analytics (page views, no PII)</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold">Original Publishers</td>
                  <td className="p-3 text-[var(--foreground-muted)]">Outbound &ldquo;Read original source&rdquo; links</td>
                  <td className="p-3 text-[var(--foreground-muted)]">Standard referrer header on click-through</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="font-serif text-[var(--foreground-muted)] leading-relaxed">
            Clicking an outbound link redirects you to third-party domains governed by their own privacy policies. Ultra News assumes no responsibility for the tracking apparatus deployed by original publishers.
          </p>
        </section>

        {/* §5 Data Retention */}
        <section id="section-5">
          <h2 className="font-display text-2xl font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <span className="font-data text-[12px] text-[var(--accent)]">§5</span>
            Data Retention
          </h2>
          <div className="font-serif text-[var(--foreground-muted)] space-y-4 leading-relaxed">
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-left font-data text-[12px] border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden">
                <thead className="bg-[var(--surface-elevated)] text-[var(--foreground-muted)]">
                  <tr>
                    <th className="p-3 font-normal uppercase tracking-wider text-[10px]">Data Type</th>
                    <th className="p-3 font-normal uppercase tracking-wider text-[10px]">Retention Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                  <tr>
                    <td className="p-3">Server access logs</td>
                    <td className="p-3 text-[var(--foreground-muted)]">30 days (auto-purged)</td>
                  </tr>
                  <tr>
                    <td className="p-3">Redis cache (story data)</td>
                    <td className="p-3 text-[var(--foreground-muted)]">5 minutes TTL</td>
                  </tr>
                  <tr>
                    <td className="p-3">ISR page cache</td>
                    <td className="p-3 text-[var(--foreground-muted)]">60 seconds (revalidated on demand)</td>
                  </tr>
                  <tr>
                    <td className="p-3">Ingested articles</td>
                    <td className="p-3 text-[var(--foreground-muted)]">Indefinite (public news data)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* §6 Your Rights */}
        <section id="section-6">
          <h2 className="font-display text-2xl font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <span className="font-data text-[12px] text-[var(--accent)]">§6</span>
            Your Rights
          </h2>
          <div className="font-serif text-[var(--foreground-muted)] space-y-4 leading-relaxed">
            <p>
              Because we do not collect or store personal data, most data subject rights (right to access, right to erasure, right to portability) are trivially satisfied — there is nothing to access, erase, or port.
            </p>
            <p>
              If you believe we have inadvertently collected personal information, you have the right to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Right to Access</strong> — Request confirmation of what data, if any, we hold about you.</li>
              <li><strong>Right to Erasure</strong> — Request deletion of any personal data we may hold.</li>
              <li><strong>Right to Rectification</strong> — Request correction of inaccurate data.</li>
              <li><strong>Right to Object</strong> — Object to processing of your personal data.</li>
            </ul>
            <p>
              These rights are recognized under GDPR (EU), CCPA (California), and equivalent frameworks. To exercise any right, open an issue on our GitHub repository or contact us directly.
            </p>
          </div>
        </section>

        {/* §7 Contact */}
        <section id="section-7">
          <div className="bg-[var(--surface-elevated)] p-6 rounded-[var(--radius-card)] border border-[var(--border)]">
            <h3 className="font-data text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] mb-2 mt-0 flex items-center gap-2">
              <span className="font-data text-[12px]">§7</span>
              Questions?
            </h3>
            <p className="text-sm font-serif text-[var(--foreground-muted)] m-0">
              If you have inquiries regarding how data is managed, please review the{' '}
              <a href="https://github.com/emmanuelrichard01/ULTRA-NEWS" className="text-[var(--foreground)] font-semibold hover:underline">
                open-source repository
              </a>{' '}
              or{' '}
              <a href="https://github.com/emmanuelrichard01/ULTRA-NEWS/issues" className="text-[var(--foreground)] font-semibold hover:underline">
                open an issue on GitHub
              </a>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
