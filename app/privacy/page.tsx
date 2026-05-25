import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · Melange",
  description: "How Melange handles your data.",
};

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: May 2026</p>

        <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed space-y-6">
          <p>
            Melange (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps creative people find each other and collaborate.
            We take your privacy seriously. This document explains what data we collect and why.
          </p>

          <Section title="What we collect">
            <p>When you create an account we collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your <strong>email address and password</strong> (handled by Supabase Auth — your password is hashed and never visible to us)</li>
              <li>Your <strong>profile</strong>: name, role, skills, bio, current project, and an optional avatar photo</li>
              <li><strong>Posts</strong> you publish: title, description, what you&rsquo;re looking for, location, compensation, and any images you upload</li>
              <li><strong>Swipes</strong>: which posts you liked or passed on</li>
              <li><strong>Matches</strong>: which other users mutually liked your posts</li>
              <li><strong>Messages</strong> you send through the app</li>
              <li>A <strong>device push token</strong> (only if you opt in to notifications on iOS), used to send you a notification when you match with someone or receive a new message</li>
              <li>Basic <strong>diagnostics</strong>: crash reports and aggregate usage. We do not sell this data and we do not use it for advertising.</li>
            </ul>
            <p>
              We <strong>do not</strong> collect your contact list, location (beyond what you type into your profile), or
              browsing history.
            </p>
          </Section>

          <Section title="How we use it">
            <ul className="list-disc pl-6 space-y-1">
              <li>To run the app: show you other creatives, deliver messages, send push notifications</li>
              <li>To keep the community safe: handle reports and blocks</li>
              <li>To improve the product: anonymous aggregate usage analytics</li>
            </ul>
            <p>We do not sell your personal data and we do not show ads.</p>
          </Section>

          <Section title="Who sees what">
            <ul className="list-disc pl-6 space-y-1">
              <li>Your <strong>profile</strong>, <strong>posts</strong>, and <strong>avatar</strong> are visible to other signed-in Melange users.</li>
              <li><strong>Messages</strong> are private between you and the other person in a match.</li>
              <li><strong>Swipes</strong> are private to you (the post owner cannot see whether you liked or passed).</li>
              <li><strong>Reports</strong> and <strong>blocks</strong> are only visible to you and to our moderation team.</li>
            </ul>
          </Section>

          <Section title="Your rights">
            <p>You can:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Edit your profile and posts</strong> at any time in the app.</li>
              <li>
                <strong>Delete your account</strong> in Profile → Account &amp; safety → Delete account.
                This permanently removes your profile, posts, swipes, matches, messages, push tokens, and uploaded media.
              </li>
              <li>
                <strong>Export your data</strong> by emailing us at{" "}
                <a href="mailto:privacy@melange.app" className="text-blue-700 underline">privacy@melange.app</a>.
              </li>
            </ul>
          </Section>

          <Section title="Children">
            <p>
              Melange is not intended for use by anyone under 18. If you believe a minor has created an account,
              please report it via the in-app Report flow and we will remove it.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              <a href="mailto:privacy@melange.app" className="text-blue-700 underline">privacy@melange.app</a>
            </p>
          </Section>
        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 px-4 mt-12">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <span>© 2026 Melange</span>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-gray-700">Terms</Link>
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
