import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Compass, Heart, KeyRound, MoonStar, ShieldCheck, Users } from "lucide-react";

import Logo from "./components/Logo";
import WaitlistForm from "./components/WaitlistForm";
import { SiteFooter, SiteHeader } from "./components/SiteChrome";
import { SCENES } from "./lib/scenes";
import { APP_STORE_URL, IOS_LIVE, SITE, SUPPORT_PATH } from "./lib/site";

export const metadata: Metadata = {
  title: { absolute: "Melange — Where young creatives find their crew" },
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

function WaitlistCta({ className = "" }: { className?: string }) {
  return (
    <a
      href="#waitlist"
      className={`melange-btn-primary inline-flex items-center justify-center rounded-xl px-7 py-3.5 text-base font-semibold text-white ${className}`}
    >
      Join the waitlist
    </a>
  );
}

function CodeCta({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/join"
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white/70 px-7 py-3.5 text-base font-semibold text-indigo-900 backdrop-blur transition hover:bg-white ${className}`}
    >
      <KeyRound className="h-4 w-4" />
      I have a code
    </Link>
  );
}

/* ------------------------------------------------------------------ */

const STEPS = [
  {
    n: "01",
    title: "Get invited",
    body: "Every member has five codes. A friend sends you one, and you're in their scene. No code yet? Join the waitlist — we open scenes a few people at a time.",
  },
  {
    n: "02",
    title: "Go to a night",
    body: "Melange Nights and members' events are where the scene meets. Before it, see who's going and talk in the night chat.",
  },
  {
    n: "03",
    title: "Find your people",
    body: "After the night, quietly heart anyone you'd like to see again. They'll only know if they hearted you too — then a conversation opens.",
  },
  {
    n: "04",
    title: "Explore the scene",
    body: "Between nights, Explore is the scene's moodboard: shoots and ideas from the people around you, picked by editors.",
  },
];

const PILLARS = [
  {
    icon: Users,
    title: "The people",
    body: "Photographers, stylists, musicians, designers, the friend who always knows the spot. Find the ones you want to go out with and make things with.",
  },
  {
    icon: MoonStar,
    title: "The nights",
    body: "Small nights, hosted by the scene. Show up, meet people in a room instead of a DM, and keep talking in the night chat after.",
  },
  {
    icon: Compass,
    title: "The ideas",
    body: "A moodboard of what your scene is making right now, with everyone who made it credited. Taste is how you find each other.",
  },
];

// Captured from the iOS app (1.7) on a demo account, so every face and name
// in them is seeded demo content, not a real user.
const SCREENS = [
  { src: "/screenshots/discover.png", label: "Discover people from your scene" },
  { src: "/screenshots/explore.png", label: "Explore the scene's moodboard" },
  { src: "/screenshots/showcase.png", label: "Every shoot credits the people who made it" },
];

function PhoneShot({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[2.2rem] border-[6px] border-slate-900 bg-slate-900 shadow-2xl shadow-indigo-900/20">
      <Image
        src={src}
        alt={alt}
        width={603}
        height={1311}
        priority={priority}
        className="h-auto w-full rounded-[1.7rem]"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function MarketingHome() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-white">
      <SiteHeader landing />

      {/* ---------------- Hero ---------------- */}
      <section className="melange-bg relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 py-20 sm:py-28 lg:grid-cols-[1.15fr_1fr]">
          <div className="text-center lg:text-left">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/70 px-4 py-1.5 text-sm font-medium text-indigo-800 backdrop-blur">
              ✦ Invite-only · USC · UCSD · LA
            </p>

            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl">
              Where young creatives find their{" "}
              <span className="melange-wordmark">crew</span>
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-600 sm:text-xl lg:max-w-none">
              The people, the nights, the ideas. Melange is where your scene
              meets: go to a night, find the people you click with, and see
              what everyone around you is making.
            </p>

            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <WaitlistCta />
              <CodeCta />
            </div>

            <p className="mt-6 text-sm text-slate-500">
              Free. No ads. Not a dating app, not a networking app.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[300px]">
            <div className="absolute -inset-8 -z-10 rounded-full bg-indigo-200/40 blur-3xl" />
            <PhoneShot src={SCREENS[0].src} alt="Melange on iPhone" priority />
          </div>
        </div>
      </section>

      {/* ---------------- The people, the nights, the ideas ---------------- */}
      <section className="border-y border-indigo-100/70 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PILLARS.map((p) => (
              <div key={p.title} className="melange-card rounded-2xl p-7">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                  <p.icon className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900">{p.title}</h2>
                <p className="mt-2 leading-relaxed text-slate-600">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Scenes ---------------- */}
      <section id="scenes" className="bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">
              It starts in scenes
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
              A few places at a time, so the people you meet are actually near
              you.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SCENES.map((s) => (
              <li
                key={s.id}
                className={`rounded-2xl border p-6 ${
                  s.live
                    ? "melange-card"
                    : "border-dashed border-slate-300 bg-slate-50/70"
                }`}
              >
                <p
                  className={`text-3xl font-bold tracking-tight ${
                    s.live ? "melange-wordmark" : "text-slate-400"
                  }`}
                >
                  {s.label}
                </p>
                <p className="mt-1 text-slate-600">{s.place}</p>
                <p
                  className={`mt-4 text-sm font-semibold ${
                    s.live ? "text-indigo-700" : "text-slate-500"
                  }`}
                >
                  {s.live ? "Live now" : "Soon"}
                </p>
              </li>
            ))}
          </ul>
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
              From a friend&apos;s code to your crew.
            </p>
          </div>

          <ol className="space-y-4">
            {STEPS.map((s) => (
              <li key={s.n} className="melange-card flex gap-6 rounded-2xl p-7 sm:gap-8">
                <span className="melange-wordmark shrink-0 text-3xl font-bold tabular-nums">
                  {s.n}
                </span>
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-slate-600">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- Screens ---------------- */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-14 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">
              The app, as it is today
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
              Real screens from Melange on iPhone.
            </p>
          </div>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
            {SCREENS.map((sc) => (
              <figure key={sc.src} className="mx-auto w-full max-w-[260px] text-center">
                <PhoneShot src={sc.src} alt={sc.label} />
                <figcaption className="mt-4 text-sm font-medium text-slate-700">
                  {sc.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Afterglow ---------------- */}
      <section className="border-y border-indigo-100/70 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <div className="mx-auto mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
            <Heart className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            After the night
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            Heart anyone you&apos;d like to see again. They&apos;ll only know if
            they hearted you too. No cold DMs, no one keeping score — just a
            quiet way to say &ldquo;let&apos;s do this again.&rdquo;
          </p>
        </div>
      </section>

      {/* ---------------- Safety ---------------- */}
      <section id="safety" className="melange-bg">
        <div className="mx-auto max-w-4xl px-6 py-24">
          <div className="melange-card rounded-3xl p-8 sm:p-14">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Meeting new people is a real decision
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              We treat it like one. Everyone here was invited by someone. You
              can block or report any person, post, or message — including in a
              night chat — and reports go to a human. Every account is 18+. Your
              data is locked to your account at the database level, and you can
              delete your account, and everything in it, from inside the app.
            </p>
            <p className="mt-5 leading-relaxed text-slate-600">
              Questions or concerns:{" "}
              <Link
                className="font-medium text-indigo-700 underline underline-offset-4"
                href={SUPPORT_PATH}
              >
                contact us
              </Link>
              . A person reads every message.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- Waitlist ---------------- */}
      <section id="waitlist" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-2xl px-6 py-24">
          <div className="mb-10 text-center">
            <Logo size="lg" />
            <h2 className="mt-8 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Melange is invite-only
            </h2>
            <p className="mt-5 text-lg text-slate-600">
              Get on the list and we&apos;ll let you in when your scene opens
              up. Got a code from a friend?{" "}
              <Link
                href="/join"
                className="font-medium text-indigo-700 underline underline-offset-4"
              >
                Use it here
              </Link>
              .
            </p>
          </div>
          <div className="melange-card rounded-3xl p-6 sm:p-10">
            <WaitlistForm />
          </div>
          {IOS_LIVE ? (
            <p className="mt-6 text-center text-sm text-slate-500">
              Already a member?{" "}
              <a
                href={APP_STORE_URL}
                className="font-medium text-indigo-700 underline underline-offset-4"
              >
                Get the iPhone app
              </a>
              .
            </p>
          ) : null}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
