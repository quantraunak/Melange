import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

import SupportForm from "../components/SupportForm";

export const metadata: Metadata = {
  title: "Support · Melange",
  description: "Contact Melange support for help with your account.",
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="mb-3 font-display text-5xl font-semibold leading-[1.05] tracking-tight">Support</h1>
        <p className="text-sm text-gray-500 mb-8">We typically respond within 2 business days.</p>

        <div className="text-gray-700 leading-relaxed space-y-6">
          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-ink">Contact us</h2>
            <p>
              For account help, safety concerns, privacy or data requests, or App Store review questions.
              You don&apos;t need to be signed in. A person reads every message.
            </p>
            <SupportForm />
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-ink">In-app help</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Report a user or post from the flag icon on posts or in chat.</li>
              <li>Block someone from the conversation menu in Messages.</li>
              <li>Delete your account under Profile → Settings → Delete account.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-ink">Legal</h2>
            <p>
              <Link href="/privacy" className="text-action underline underline-offset-4">
                Privacy Policy
              </Link>
              {" · "}
              <Link href="/terms" className="text-action underline underline-offset-4">
                Terms of Service
              </Link>
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
