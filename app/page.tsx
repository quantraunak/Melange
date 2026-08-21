import type { Metadata } from "next";
import Link from "next/link";
import {
  Camera,
  CalendarDays,
  Images,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import Logo from "./components/Logo";
import {
  APP_STORE_URL,
  IOS_LIVE,
  SITE,
  SUPPORT_EMAIL,
  WEB_APP_PATH,
} from "./lib/site";

export const metadata: Metadata = {
  title: "Melange — Where creative people find their next collaboration",
  description: SITE.description,
  openGraph: {
    title: "Melange",
    description: SITE.tagline,
    url: SITE.url,
    siteName: "Melange",
    type: "website",
  },
};

/* ------------------------------------------------------------------ */

function PrimaryCta({ className = "" }: { className?: string }) {
  if (IOS_LIVE) {
    return (
      <a
        href={APP_STORE_URL}
        className={`melange-btn-primary inline-flex items-center justify-center rounded-xl px-7 py-3.5 text-base font-semibold text-white ${className}`}
      >
        Download for iPhone
      </a>
    );
  }
  return (
    <Link
      href={WEB_APP_PATH}
      className={`melange-btn-primary inline-flex items-center justify-center rounded-xl px-7 py-3.5 text-base font-semibold text-white ${className}`}
    >
      Start in your browser
    </Link>
  );
}

function SecondaryCta({ className = "" }: { className?: string }) {
  if (IOS_LIVE) {
    return (
      <Link
        href={WEB_APP_PATH}
        className={`inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-white/70 px-7 py-3.5 text-base font-semibold text-indigo-900 backdrop-blur transition hover:bg-white ${className}`}
      >
        Or use it in your browser
      </Link>
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white/70 px-7 py-3.5 text-base font-medium text-indigo-900/80 backdrop-blur ${className}`}
    >
      <Sparkles className="h-4 w-4" />
      iPhone app coming soon
    </span>
  );
}

/* ------------------------------------------------------------------ */

const STEPS = [
  {
    n: "01",
    title: "Build a profile that shows the work",
    body: "Your role, your skills, and up to nine portfolio images. The grid is the resume — people decide from the work, not the bio.",
  },
  {
    n: "02",
    title: "Post what you're working on",
    body: "A concept, a location, a date, paid or TFP, and who you still need. Up to five reference images so the aesthetic is obvious.",
  },
  {
    n: "03",
    title: "Swipe through real projects",
    body: "Not headshots — actual briefs from photographers, models, MUAs, stylists and filmmakers near you.",
  },
  {
    n: "04",
    title: "Match when it's mutual",
    body: "Both of you liked the work. No cold DMs, no wondering whether you're bothering someone.",
  },
  {
    n: "05",
    title: "Message and plan the shoot",
    body: "Realtime chat with push notifications, so the conversation doesn't die in a request folder.",
  },
];

const FEATURES = [
  {
    icon: Images,
    title: "Portfolio, not just a profile",
    body: "A nine-image gallery with a fullscreen lightbox, plus a “more from this creator” strip on every post. You're swiping on a body of work, not one photo.",
  },
  {
    icon: CalendarDays,
    title: "Events you can show up to",
    body: "Photo walks, open calls, gallery openings, golden-hour meetups. Browse by city, RSVP, and meet people in a group before committing to a one-on-one shoot.",
  },
  {
    icon: Sparkles,
    title: "Matched on taste, not just role",
    body: "Vibe tags — moody, editorial, street, golden hour, black-and-white film — shape your feed. A perfect role match with no shared taste is not a match.",
  },
  {
    icon: Star,
    title: "Reviews after the collab",
    body: "Both people review each other once the shoot is done, and both reviews appear together. A real track record beats a follower count.",
  },
  {
    icon: MessageCircle,
    title: "Chat that keeps up",
    body: "Realtime messages, unread counts that stay in sync across your phone and your laptop, and push notifications for matches and replies.",
  },
  {
    icon: Users,
    title: "One account, both screens",
    body: "Sign up on your phone, sign in on the web. Same profile, same matches, same conversations.",
  },
];

const ROLES = [
  "Photographers",
  "Models",
  "Makeup artists",
  "Stylists",
  "Filmmakers",
  "Art directors",
  "Set designers",
  "Retouchers",
];

/* ------------------------------------------------------------------ */

export default function MarketingHome() {
  return (
    <main className="min-h-screen bg-white">
      {/* ---------------- Nav ---------------- */}
      <header className="melange-header sticky top-0 z-50">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size="sm" />
            <span className="melange-wordmark text-2xl font-bold">Melange</span>
          </Link>
          <div className="flex items-center gap-6">
            <a
              href="#how"
              className="hidden text-sm font-medium text-slate-600 transition hover:text-indigo-700 sm:block"
            >
              How it works
            </a>
            <a
              href="#safety"
              className="hidden text-sm font-medium text-slate-600 transition hover:text-indigo-700 sm:block"
            >
              Safety
            </a>
            <Link
              href={WEB_APP_PATH}
              className="melange-btn-primary rounded-lg px-4 py-2 text-sm font-semibold text-white"
            >
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className="melange-bg relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/70 px-4 py-1.5 text-sm font-medium text-indigo-800 backdrop-blur">
              <Camera className="h-3.5 w-3.5" />
              For photographers, models, MUAs, stylists &amp; filmmakers
            </p>

            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
              Where creative people
              <br />
              find their next{" "}
              <span className="melange-wordmark">collaboration</span>
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
              A photographer needs a model. A model needs a stylist. A filmmaker
              needs a whole crew. Right now that happens through Instagram DMs
              and group chats. Melange is a place built for it.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCta />
              <SecondaryCta />
            </div>

            <p className="mt-6 text-sm text-slate-500">
              Free to use. No ads, no in-app purchases.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- The problem ---------------- */}
      <section className="border-y border-indigo-100/70 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="grid gap-10 md:grid-cols-2 md:gap-16">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Instagram was never built for this
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600">
                Search is useless for finding a stylist in your city this
                weekend. There is no way to say “I want to shoot you” without it
                landing in a request folder next to a hundred strangers. And
                nothing tells you whether someone is actually good to work
                with.
              </p>
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Job boards feel like Craigslist
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600">
                They treat “photographer” as a job title, as if any one of them
                is interchangeable with any other. But taste is the whole thing.
                A moody portrait shooter and a bright commercial shooter are not
                the same hire, and everybody in the room knows it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how" className="bg-slate-50/70">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <div className="mb-16 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">
              How it works
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
              Five steps from signing up to standing on set.
            </p>
          </div>

          <ol className="space-y-4">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="melange-card flex gap-6 rounded-2xl p-7 sm:gap-8"
              >
                <span className="melange-wordmark shrink-0 text-3xl font-bold tabular-nums">
                  {s.n}
                </span>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    {s.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-slate-600">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-16 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">
              What&apos;s inside
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="melange-card rounded-2xl p-7">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {f.title}
                </h3>
                <p className="mt-2 leading-relaxed text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Safety ---------------- */}
      <section id="safety" className="melange-bg">
        <div className="mx-auto max-w-4xl px-6 py-24">
          <div className="melange-card rounded-3xl p-10 sm:p-14">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Meeting a stranger for a shoot is a real decision
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              We treat it like one. You can block or report any person, post, or
              message, and reports go to a human. Every account is 18+. Your
              data is locked to your account at the database level, and you can
              delete your account — and everything in it — from inside the app,
              without emailing anyone.
            </p>
            <p className="mt-5 leading-relaxed text-slate-600">
              Questions or concerns:{" "}
              <a
                className="font-medium text-indigo-700 underline underline-offset-4"
                href={`mailto:${SUPPORT_EMAIL}`}
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- Roles ---------------- */}
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Built for the people who make the picture
          </h2>
          <div className="mt-9 flex flex-wrap justify-center gap-2.5">
            {ROLES.map((r) => (
              <span
                key={r}
                className="rounded-full border border-indigo-100 bg-indigo-50/60 px-4 py-2 text-sm font-medium text-indigo-900"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Closing CTA ---------------- */}
      <section className="melange-bg border-t border-indigo-100/70">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <Logo size="lg" />
          <h2 className="mt-8 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Your next shoot starts with one swipe
          </h2>
          <p className="mt-5 text-lg text-slate-600">
            Post a project, or just see who&apos;s working near you.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PrimaryCta />
            <SecondaryCta />
          </div>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <Link href="/" className="flex items-center gap-2.5">
              <Logo size="sm" />
              <span className="melange-wordmark text-xl font-bold">
                Melange
              </span>
            </Link>

            <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm text-slate-600">
              <Link className="transition hover:text-indigo-700" href="/app">
                Open the app
              </Link>
              <Link className="transition hover:text-indigo-700" href="/support">
                Support
              </Link>
              <Link className="transition hover:text-indigo-700" href="/privacy">
                Privacy
              </Link>
              <Link className="transition hover:text-indigo-700" href="/terms">
                Terms
              </Link>
              <a
                className="transition hover:text-indigo-700"
                href={`mailto:${SUPPORT_EMAIL}`}
              >
                Contact
              </a>
            </nav>
          </div>

          <p className="mt-9 text-center text-sm text-slate-400 sm:text-left">
            © {new Date().getFullYear()} Melange. Made for people who make
            things.
          </p>
        </div>
      </footer>
    </main>
  );
}
