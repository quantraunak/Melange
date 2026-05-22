import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · Melange",
  description: "How Melange handles your data.",
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="text-[13px] text-[var(--ink-3)] mt-3 mb-12">Last updated: May 2026</p>

        <div className="space-y-10 text-[15px] leading-relaxed text-[var(--ink-2)]">
          <p>
            Melange (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps creative people find each other and collaborate.
            We take your privacy seriously. This document explains what data we collect and why.
          </p>

          <Section title="What we collect">
            <p>When you create an account we collect:</p>
            <Bullets>
              <li>Your <strong>email and password</strong> — handled by Supabase Auth, your password is hashed and never visible to us.</li>
              <li>Your <strong>profile</strong>: name, role, skills, bio, current project, and an optional avatar photo.</li>
              <li><strong>Posts</strong> you publish: title, description, what you&rsquo;re looking for, location, compensation, and any images you upload.</li>
              <li><strong>Swipes</strong>: which posts you liked or passed on.</li>
              <li><strong>Matches</strong>: which other users mutually liked your posts.</li>
              <li><strong>Messages</strong> you send through the app.</li>
              <li>A <strong>device push token</strong> — only if you opt in to notifications on iOS — used to alert you when you match or receive a new message.</li>
              <li>Basic <strong>diagnostics</strong>: crash reports and aggregate usage. We do not sell this data and we do not use it for advertising.</li>
            </Bullets>
            <p>
              We <strong>do not</strong> collect your contact list, location (beyond what you type into your profile), or
              browsing history.
            </p>
          </Section>

          <Section title="How we use it">
            <Bullets>
              <li>To run the app: show you other creatives, deliver messages, send push notifications.</li>
              <li>To keep the community safe: handle reports and blocks.</li>
              <li>To improve the product: anonymous aggregate usage analytics.</li>
            </Bullets>
            <p>We do not sell your personal data and we do not show ads.</p>
          </Section>

          <Section title="Who sees what">
            <Bullets>
              <li>Your <strong>profile</strong>, <strong>posts</strong>, and <strong>avatar</strong> are visible to other signed-in Melange users.</li>
              <li><strong>Messages</strong> are private between you and the other person in a match.</li>
              <li><strong>Swipes</strong> are private to you — the post owner cannot see whether you liked or passed.</li>
              <li><strong>Reports</strong> and <strong>blocks</strong> are visible only to you and to our moderation team.</li>
            </Bullets>
          </Section>

          <Section title="Your rights">
            <p>You can:</p>
            <Bullets>
              <li><strong>Edit your profile and posts</strong> at any time in the app.</li>
              <li>
                <strong>Delete your account</strong> in Profile → Account &amp; safety → Delete account.
                This permanently removes your profile, posts, swipes, matches, messages, push tokens, and uploaded media.
              </li>
              <li>
                <strong>Export your data</strong> by emailing us at{" "}
                <a href="mailto:privacy@melange.app" className="text-[var(--ink)] underline underline-offset-2">
                  privacy@melange.app
                </a>
                .
              </li>
            </Bullets>
          </Section>

          <Section title="Children">
            <p>
              Melange is not intended for use by anyone under 18. If you believe a minor has created an account,
              please report it via the in-app Report flow and we will remove it.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              <a href="mailto:privacy@melange.app" className="text-[var(--ink)] underline underline-offset-2">
                privacy@melange.app
              </a>
            </p>
          </Section>
        </div>
      </main>

      <footer className="border-t border-[var(--line)] py-6 px-6 mt-12">
        <div className="max-w-[820px] mx-auto flex items-center justify-between text-[12px] text-[var(--ink-3)]">
          <span>© {new Date().getFullYear()} Melange</span>
          <div className="flex gap-5">
            <Link href="/terms" className="hover:text-[var(--ink)] transition-colors">Terms</Link>
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
