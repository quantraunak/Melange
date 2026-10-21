import type { Metadata } from "next";
import Link from "next/link";

import CopyCode from "../components/CopyCode";
import WaitlistForm from "../components/WaitlistForm";
import { FoundingMark, SiteFooter, SiteHeader } from "../components/SiteChrome";
import { APP_STORE_URL, IOS_LIVE } from "../lib/site";

export const metadata: Metadata = {
  title: "Your founding code",
  description: "A friend sent you a founding code for Melange. Enter it in the app to get the Founding mark.",
  openGraph: {
    title: "A founding code for Melange",
    description: "Where creative people find their next collaboration. A friend sent you a founding code.",
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

/**
 * Since 1.9 anyone can sign up; a founding code is optional and only grants
 * the Founding mark (redeem_invite, one code per person), entered from the
 * You tab.
 */
const STEPS = [
  { title: "Download Melange", body: "It's free on iPhone. Anyone can sign up." },
  { title: "Sign up", body: "Make an account with your email. It takes a minute." },
  {
    title: "Enter your code",
    body: "On the You tab, tap “Have a founding code?” and paste it in.",
  },
];

function GetAppButton() {
  return IOS_LIVE ? (
    <a
      href={APP_STORE_URL}
      className="melange-btn-primary inline-flex w-full items-center justify-center rounded-lg px-6 py-3 text-base font-semibold text-white sm:w-auto"
    >
      Get the app
    </a>
  ) : (
    <p className="text-muted-ink">The iPhone app is almost here.</p>
  );
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const code = cleanCode((await searchParams).code);

  return (
    <main className="min-h-screen overflow-x-hidden bg-paper text-ink">
      <SiteHeader />

      {code ? (
        <section>
          <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
            <FoundingMark />
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Your founding code
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-ink">
              A friend sent it to you. Enter it in Melange and your profile gets the
              Founding mark: one of the first people in your scene.
            </p>

            <div className="mt-10 border-y border-rule py-8">
              <p className="melange-label mb-4">The code</p>
              <CopyCode code={code} />
            </div>

            <div className="mt-8">
              <GetAppButton />
            </div>

            <ol className="mt-12 divide-y divide-rule border-y border-rule">
              {STEPS.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[2rem_1fr] gap-x-3 py-5">
                  <span className="font-display text-xl leading-none tabular-nums text-muted-ink">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-semibold">{s.title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-ink">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-8 text-sm leading-relaxed text-muted-ink">
              You don&apos;t need the code to sign up. If it doesn&apos;t work, check it with
              whoever sent it; each person can redeem one code.
            </p>
          </div>
        </section>
      ) : (
        <section>
          <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
            <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Anyone can join Melange
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-ink">
              Download the app and sign up; no code needed. If a friend gave you a founding
              code, enter it on the You tab.
            </p>
            <div className="mt-8">
              <GetAppButton />
            </div>

            <div className="mt-14 border-t border-rule pt-10">
              <h2 className="font-display text-3xl font-semibold leading-tight">
                Not in USC, UCSD or LA?
              </h2>
              <p className="mt-3 leading-relaxed text-muted-ink">
                Leave your email and where you are, and we&apos;ll send
                you the link when someone hosts one nearby.
              </p>
              <div className="mt-8">
                <WaitlistForm />
              </div>
            </div>

            <p className="mt-10 text-sm text-muted-ink">
              <Link href="/" className="underline underline-offset-4 hover:text-ink">
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
