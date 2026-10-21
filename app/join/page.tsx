import type { Metadata } from "next";
import Link from "next/link";

import CopyCode from "../components/CopyCode";
import WaitlistForm from "../components/WaitlistForm";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { APP_STORE_URL, IOS_LIVE } from "../lib/site";

export const metadata: Metadata = {
  title: "You're invited",
  description: "Someone saved you a spot on Melange — where young creatives find their crew.",
  openGraph: {
    title: "You're invited to Melange",
    description: "Where young creatives find their crew — the people, the nights, the ideas.",
  },
  // Codes are personal; keep the pages they're printed on out of search.
  robots: { index: false, follow: true },
};

/** MEL-XXXXX from the share link; tolerate case and stray characters. */
function cleanCode(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const c = v.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  return c.length >= 4 ? c : null;
}

const STEPS = [
  { n: "1", title: "Download Melange", body: "Get the iPhone app from the App Store." },
  { n: "2", title: "Sign up", body: "Make an account with your email. It takes a minute." },
  { n: "3", title: "Enter your code", body: "Type it in when the app asks, and you're in." },
];

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const code = cleanCode((await searchParams).code);

  return (
    <main className="min-h-screen overflow-x-hidden bg-white">
      <SiteHeader />

      {code ? (
        <section className="melange-bg">
          <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 sm:py-24">
            <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/70 px-4 py-1.5 text-sm font-medium text-indigo-800 backdrop-blur">
              ✦ Invite-only
            </p>
            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
              You&apos;re invited to <span className="melange-wordmark">Melange</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-lg text-slate-600">
              A friend saved you a spot. Melange is where young creatives find
              their crew — the people, the nights, the ideas.
            </p>

            <div className="melange-card mx-auto mt-10 rounded-3xl px-4 py-8 sm:px-10">
              <p className="mb-4 text-sm font-medium uppercase tracking-widest text-slate-500">
                Your invite code
              </p>
              <CopyCode code={code} />
            </div>

            <div className="mt-8">
              {IOS_LIVE ? (
                <a
                  href={APP_STORE_URL}
                  className="melange-btn-primary inline-flex w-full items-center justify-center rounded-xl px-7 py-3.5 text-base font-semibold text-white sm:w-auto"
                >
                  Download on the App Store
                </a>
              ) : (
                <p className="text-slate-600">The iPhone app is almost here. Keep this code.</p>
              )}
            </div>

            <ol className="mt-12 grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="melange-card rounded-2xl p-5">
                  <span className="melange-wordmark text-2xl font-bold tabular-nums">{s.n}</span>
                  <h2 className="mt-2 font-semibold text-slate-900">{s.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </li>
              ))}
            </ol>

            <p className="mt-10 text-sm text-slate-500">
              Code not working? Check it with whoever sent it — each code works once.
            </p>
          </div>
        </section>
      ) : (
        <section className="melange-bg">
          <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="mb-10 text-center">
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Melange is invite-only
              </h1>
              <p className="mt-5 text-lg text-slate-600">
                Got a code from a friend? Download the app, sign up, and enter
                it there. No code yet? Join the waitlist and we&apos;ll let you
                in when your scene opens up.
              </p>
              {IOS_LIVE ? (
                <a
                  href={APP_STORE_URL}
                  className="mt-6 inline-flex font-medium text-indigo-700 underline underline-offset-4"
                >
                  I have a code — get the app
                </a>
              ) : null}
            </div>
            <div className="melange-card rounded-3xl p-6 sm:p-10">
              <WaitlistForm />
            </div>
            <p className="mt-8 text-center text-sm text-slate-500">
              <Link href="/" className="underline underline-offset-4 hover:text-indigo-700">
                What is Melange?
              </Link>
            </p>
          </div>
        </section>
      )}

      <SiteFooter />
    </main>
  );
}
