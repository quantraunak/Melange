import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = {
  title: "Privacy Policy · Melange",
  description: "How Melange handles your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="mb-3 font-display text-5xl font-semibold leading-[1.05] tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: October 2026</p>

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
              <li><strong>Swipes and hearts</strong>: which posts you liked or passed on, and which profiles or work you hearted</li>
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
              <li>To improve the product: usage analytics (which screens and actions are used), linked to your account so we can measure what works. We do not sell it or use it for ads.</li>
            </ul>
            <p>We do not sell your personal data and we do not show ads.</p>
          </Section>

          <Section title="Who sees what">
            <ul className="list-disc pl-6 space-y-1">
              <li>Your <strong>profile</strong>, <strong>posts</strong>, and <strong>avatar</strong> are visible to other signed-in Melange users.</li>
              <li><strong>Messages</strong> are private between you and the other person in a match.</li>
              <li><strong>Likes and hearts are not private.</strong> When you like someone&rsquo;s project or heart their profile or work, they are told it was you, and they can message you. <strong>Passes are private</strong>: nobody is ever told you passed on them.</li>
              <li>
                <strong>Nights you&rsquo;re going to.</strong> Every night has a share page (a link like{" "}
                melange-psi.vercel.app/n/&hellip;) that anyone with the link can open, signed in or not. If you
                RSVP &ldquo;going&rdquo;, your <strong>first name and profile photo</strong> can be shown on that
                night&rsquo;s share page, along with the host&rsquo;s first name and photo and how many people are
                going. Change your RSVP and you&rsquo;re no longer shown.
                RSVPing on a night page stores your name and email to hold your spot and, if you join Melange
                with that email, connect the RSVP to your account.
              </li>
              <li><strong>Reports</strong> and <strong>blocks</strong> are only visible to you and to our moderation team.</li>
            </ul>
          </Section>

          <Section title="Your rights">
            <p>You can:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Edit your profile and posts</strong> at any time in the app.</li>
              <li>
                <strong>Delete your account</strong> in Profile → Settings → Delete account.
                This permanently removes your profile, posts, swipes, matches, messages, push tokens, and uploaded media.
              </li>
              <li>
                <strong>Export your data</strong> by sending a request through our{" "}
                <a href="/support" className="text-blue-700 underline">support form</a> (choose &ldquo;Privacy or a data request&rdquo;).
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
              Use the <a href="/support" className="text-blue-700 underline">support form</a> and choose
              &ldquo;Privacy or a data request&rdquo;. A person reads every message.
            </p>
          </Section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
