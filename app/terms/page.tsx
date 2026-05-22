import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service · Melange",
  description: "The rules for using Melange.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col">
      <header className="border-b border-[var(--line)]">
        <div className="max-w-[820px] mx-auto px-6 py-5 flex items-center justify-between">
          <Link
            href="/"
            className="font-display text-[24px] tracking-tight text-[var(--ink)] leading-none"
          >
            melange<span className="text-[var(--accent)]">.</span>
          </Link>
          <Link
            href="/"
            className="text-[13px] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
          >
            Back to app
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-[720px] mx-auto px-6 py-14 w-full">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-3)] font-medium mb-3">
          Legal
        </p>
        <h1 className="font-display text-[44px] sm:text-[56px] leading-[1.04] tracking-tight text-[var(--ink)]">
          Terms of Service
        </h1>
        <p className="text-[13px] text-[var(--ink-3)] mt-3 mb-12">Last updated: May 2026</p>

        <div className="space-y-10 text-[15px] leading-relaxed text-[var(--ink-2)]">
          <p>Welcome to Melange. By creating an account or using the app, you agree to these Terms.</p>

          <Section title="Eligibility">
            <p>You must be at least 18 years old to use Melange.</p>
          </Section>

          <Section title="Your account">
            <p>
              You are responsible for keeping your password safe and for everything that happens on your account.
              Don&rsquo;t impersonate anyone else.
            </p>
          </Section>

          <Section title="Community rules">
            <p>
              This is a creative collaboration app. The following are <strong>not allowed</strong> and will get
              your account suspended or removed:
            </p>
            <Bullets>
              <li>Harassment, threats, hate speech, or targeted abuse of other users.</li>
              <li>Sexually explicit, violent, or graphic content.</li>
              <li>Spam, scams, off-topic promotions, or pyramid schemes.</li>
              <li>Impersonating another person or organization.</li>
              <li>Posting content you don&rsquo;t have the right to share (e.g. someone else&rsquo;s photos without permission).</li>
              <li>Soliciting payment for sexual content or services.</li>
              <li>Any illegal activity.</li>
            </Bullets>
          </Section>

          <Section title="User-generated content">
            <p>
              You own the content you post. By posting, you grant Melange a worldwide, royalty-free license
              to display that content to other users so the app can function. You are responsible for what you
              post and you must have the right to share it.
            </p>
            <p>
              We reserve the right to remove any content or account that violates these Terms, at our discretion
              and without notice.
            </p>
          </Section>

          <Section title="Reports & blocks">
            <p>
              If you see content or behavior that violates these Terms, use the Report flow in the app.
              We commit to reviewing reports promptly. You can also Block any user to prevent further contact.
            </p>
          </Section>

          <Section title="No warranties">
            <p>
              The app is provided &ldquo;as is&rdquo;. We do our best to keep it running and secure but we cannot
              guarantee uninterrupted service or that the app will be free of bugs.
            </p>
          </Section>

          <Section title="Termination">
            <p>
              You can delete your account at any time in Profile → Account &amp; safety → Delete account.
              We may suspend or terminate your account if you violate these Terms.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              We may update these Terms; if we do, we&rsquo;ll post the new version here and update the &ldquo;Last updated&rdquo; date.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              <a href="mailto:support@melange.app" className="text-[var(--ink)] underline underline-offset-2">
                support@melange.app
              </a>
            </p>
          </Section>
        </div>
      </main>

      <footer className="border-t border-[var(--line)] py-6 px-6 mt-12">
        <div className="max-w-[820px] mx-auto flex items-center justify-between text-[12px] text-[var(--ink-3)]">
          <span>© {new Date().getFullYear()} Melange</span>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-[var(--ink)] transition-colors">Privacy</Link>
            <Link href="/" className="hover:text-[var(--ink)] transition-colors">Back to app</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-[24px] tracking-tight text-[var(--ink)]">{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-6 space-y-1.5 marker:text-[var(--ink-3)]">
      {children}
    </ul>
  );
}
