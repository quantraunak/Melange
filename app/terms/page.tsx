import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service · Melange",
  description: "The rules for using Melange.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-blue-900 text-white py-6 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold italic" style={{ WebkitTextStroke: "1px #A78BFA", paintOrder: "stroke fill" }}>
            Melange
          </Link>
          <Link href="/" className="text-sm text-blue-200 hover:text-white">
            Back to app
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: May 2026</p>

        <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed space-y-6">
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
            <ul className="list-disc pl-6 space-y-1">
              <li>Harassment, threats, hate speech, or targeted abuse of other users</li>
              <li>Sexually explicit, violent, or graphic content</li>
              <li>Spam, scams, off-topic promotions, or pyramid schemes</li>
              <li>Impersonating another person or organization</li>
              <li>Posting content you don&rsquo;t have the right to share (e.g. someone else&rsquo;s photos without permission)</li>
              <li>Soliciting payment for sexual content or services</li>
              <li>Any illegal activity</li>
            </ul>
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
              <a href="mailto:support@melange.app" className="text-blue-700 underline">support@melange.app</a>
            </p>
          </Section>
        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 px-4 mt-12">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <span>© 2026 Melange</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
            <Link href="/" className="hover:text-gray-700">Back to app</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}
