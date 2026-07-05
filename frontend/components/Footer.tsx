import Link from 'next/link';

const footerLinks = [
    { name: 'About', href: '/about' },
    { name: 'Privacy', href: '/privacy' },
    { name: 'Terms', href: '/terms' },
    { name: 'RSS', href: '/rss' },
];

const socialLinks = [
    {
        name: 'X', href: 'https://x.com/mrebr', icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" /></svg>
        )
    },
    {
        name: 'LinkedIn', href: 'https://www.linkedin.com/in/e-mc/', icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        )
    },
    {
        name: 'GitHub', href: 'https://github.com/emmanuelrichard01', icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
        )
    },
];

export default function Footer() {
    return (
        <footer className="border-t border-[var(--border)] mt-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                    {/* Brand */}
                    <div className="flex flex-col items-center md:items-start gap-3">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-6 h-6 relative flex items-center justify-center">
                                <img src="/images/logo-light-mode.png" alt="Logo" className="absolute inset-0 w-full h-full object-contain dark:hidden" />
                                <img src="/images/logo-dark-mode.png" alt="Logo" className="absolute inset-0 w-full h-full object-contain hidden dark:block" />
                            </div>
                            <span className="font-data text-sm font-bold text-[var(--foreground)] uppercase">
                                Ultra<span className="text-[var(--foreground-muted)]">·</span><span className="text-[var(--foreground-muted)]">News</span>
                            </span>
                        </Link>
                        <p className="font-data text-[11px] text-[var(--foreground-muted)] text-center md:text-left">
                            Multi-source intelligence. One clear picture.
                        </p>
                    </div>

                    {/* Links */}
                    <div className="flex justify-center gap-6">
                        {footerLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className="font-data text-[11px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-150"
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    {/* Social + Copyright */}
                    <div className="flex flex-col items-center md:items-end gap-4">
                        <div className="flex gap-2">
                            {socialLinks.map((social) => (
                                <a
                                    key={social.name}
                                    href={social.href}
                                    className="p-2 rounded-[var(--radius-chip)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition-all duration-150"
                                    aria-label={social.name}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {social.icon}
                                </a>
                            ))}
                        </div>
                        <p className="font-data text-[10px] text-[var(--foreground-muted)]">
                            © {new Date().getFullYear()} Ultra News. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}
