import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Privacy.
 *
 * Written to describe what the code actually does, not adapted from a template.
 * Where a claim depends on how an operator deploys it, that is said plainly
 * rather than asserted on their behalf — this is open source, and most people
 * running it are not us.
 */

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What Ultra News collects, what it does not, and what leaves your browser.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--border)] py-9">
      <h2 className="text-display-md font-display mb-4 text-[var(--foreground)]">{title}</h2>
      <div className="text-body-md measure space-y-4 text-[var(--foreground-muted)]">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="border-b-2 border-[var(--foreground)] pb-7">
        <h1 className="text-display-2xl font-display text-[var(--foreground)]">Privacy</h1>
        <p className="text-body-lg measure mt-3 text-[var(--foreground-muted)]">
          Short version: no accounts, no tracking cookies, nothing to log in to.
          The longer version is below, including the parts that depend on who is
          hosting this.
        </p>
      </header>

      <Section title="No accounts, no profile">
        <p>
          Ultra News has no sign-up, no login and no user records. Nothing you
          read is tied to an identity, because there is no identity to tie it to.
          Your theme preference is kept in your own browser and never sent
          anywhere.
        </p>
      </Section>

      <Section title="What happens when you ask a question">
        <p>
          Questions typed into Ask the Wire Room are sent to the server, turned
          into a vector to find relevant stories, and — if the operator has
          configured an AI provider — forwarded to that provider along with the
          retrieved reporting. Answers are cached briefly so repeated questions
          are served without another call.
        </p>
        <p>
          Questions are not linked to you. They are, however, sent to a third
          party whenever an AI provider is configured, so treat the box as
          public and keep anything sensitive out of it.
        </p>
      </Section>

      <Section title="Rate limiting">
        <p>
          IP addresses are used transiently to enforce rate limits and are held
          only for the length of the limiting window. They are not stored
          alongside your questions or your reading.
        </p>
      </Section>

      <Section title="Links out">
        <p>
          Ultra News does not republish articles — every story links to the
          newsroom that wrote it. Once you follow a link you are on their site,
          under their privacy policy rather than this one.
        </p>
        <p>
          Article images load directly from publisher servers, so those servers
          see a request from your browser whenever a story with an image is
          displayed.
        </p>
      </Section>

      <Section title="Analytics">
        <p>
          This deployment includes Vercel Web Analytics, which records aggregate
          page views without cookies and without cross-site identifiers. Anyone
          self-hosting can remove it by deleting the{' '}
          <code className="font-data text-[13px]">Analytics</code> component from
          the root layout.
        </p>
      </Section>

      <Section title="If you are self-hosting">
        <p>
          This is open source, and the operator of any given deployment controls
          what it does. The statements above describe the code as published; a
          modified deployment can behave differently. If you run it yourself you
          are the data controller for it, and the code — along with the{' '}
          <Link href="/rss" className="text-[var(--accent)] underline underline-offset-2">
            source registry
          </Link>{' '}
          — is the authoritative description of behaviour.
        </p>
      </Section>
    </div>
  );
}
