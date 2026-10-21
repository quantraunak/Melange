import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import WaitlistForm from "./components/WaitlistForm";
import { SiteFooter, SiteHeader } from "./components/SiteChrome";
import { getCurrentTheme, type WeeklyTheme } from "./lib/publicData";
import { SCENES } from "./lib/scenes";
import { APP_STORE_URL, IOS_LIVE, SITE, SUPPORT_PATH } from "./lib/site";

// The weekly theme turns over on Mondays; re-read it every 10 minutes.
export const revalidate = 600;

export const metadata: Metadata = {
  title: { absolute: "Melange: small nights for people who make things" },
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

/** The one filled button on the page: the app is open to anyone. */
function GetAppCta() {
  const cls =
    "melange-btn-primary inline-flex w-full items-center justify-center rounded-lg px-6 py-3 text-base font-semibold text-white sm:w-auto";
  return IOS_LIVE ? (
    <a href={APP_STORE_URL} className={cls}>
      Get the app
    </a>
  ) : (
    <span className={`${cls} opacity-70`}>iPhone app coming soon</span>
  );
}

/**
 * This week's theme, from current_theme(). The landing page shouldn't go
 * down with the database, so a failed read is logged and the section skipped.
 */
async function loadTheme(): Promise<WeeklyTheme | null> {
  try {
    return await getCurrentTheme();
  } catch (err) {
    console.error(err);
    return null;
  }
}

/* ------------------------------------------------------------------ */

const STEPS = [
  {
    title: "A friend sends you a link",
    body: "Nights are invite-only. The link shows the place, the time, the host, and the first names of who's going. Say you're going with your name and email; you don't need the app yet.",
  },
  {
    title: "Before it, you meet the room",
    body: "In the app you can see everyone who's going and talk in the night chat, so you walk in knowing a few names.",
  },
  {
    title: "After it, heart who you'd see again",
    body: "Until three days after the night, its guest list stays open in the app. Heart anyone you'd like to make something with. They only find out if they hearted you too, and then a conversation opens.",
  },
  {
    title: "Between nights, post what you made",
    body: "Explore is your scene's wall: shoots, sets, zines, with everyone who worked on them credited. There's a theme each week if you want a prompt.",
  },
];

// Captured from the iOS app (1.7) on a demo account, so every face and name
// in them is seeded demo content, not a real user.
const SCREENS = [
  { src: "/screenshots/discover.png", label: "Discover: people in your scene." },
  { src: "/screenshots/explore.png", label: "Explore: what your scene is making." },
  { src: "/screenshots/showcase.png", label: "A shoot, with credits for everyone on it." },
];

function Screenshot({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={603}
      height={1311}
      priority={priority}
      className="h-auto w-full rounded-[1.25rem] border border-rule bg-white"
    />
  );
}

/** A hairline-topped section with a small-caps label in the margin on wide screens. */
function Section({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-rule">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-14 sm:px-6 sm:py-20 md:grid-cols-[10rem_1fr] md:gap-10">
        <p className="melange-label pt-1">{label}</p>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export default async function MarketingHome() {
  const theme = await loadTheme();

  return (
    <main className="min-h-screen overflow-x-hidden bg-paper text-ink">
      <SiteHeader landing />

      {/* ---------------- Opening ---------------- */}
      <section>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_17rem] lg:gap-16">
          <div className="min-w-0">
            <p className="melange-label">USC · UCSD · LA · NYC soon</p>

            <h1 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Small nights for people who make things.
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-ink">
              A night on Melange is a host, a place and a start time. Think a
              shoot on a rooftop, a zine table in someone&apos;s living room,
              records in a backyard. A friend sends you the link. You
              go, you meet the people there, and afterwards you can find them
              again in the app.
            </p>

            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
              <GetAppCta />
              <a
                href="#next-night"
                className="text-sm font-medium text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
              >
                Or get told about the next night near you
              </a>
            </div>

            <p className="mt-6 text-sm text-muted-ink">
              Free on iPhone. No ads. Anyone can sign up.
            </p>
          </div>

          <figure className="w-full max-w-[17rem]">
            <Screenshot src={SCREENS[0].src} alt="Melange on iPhone, the Discover tab" priority />
            <figcaption className="mt-3 text-xs text-muted-ink">
              The app today. Screens use a demo account.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ---------------- How a night works ---------------- */}
      <Section id="how" label="How it works">
        <ol className="divide-y divide-rule border-y border-rule">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[2.25rem_1fr] gap-x-3 py-7 sm:grid-cols-[3rem_1fr]">
              <span className="font-display text-2xl leading-none tabular-nums text-muted-ink">
                {i + 1}
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-semibold leading-tight sm:text-[1.75rem]">
                  {s.title}
                </h2>
                <p className="mt-2 max-w-2xl leading-relaxed text-muted-ink">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* ---------------- Scenes ---------------- */}
      <Section id="scenes" label="Where">
        <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
          A few places at a time, so the people you meet live near you.
        </h2>
        <ul className="mt-8 divide-y divide-rule border-y border-rule">
          {SCENES.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-4 py-4">
              <span className="min-w-0">
                <span className={`font-display text-2xl font-semibold ${s.live ? "" : "text-muted-ink"}`}>
                  {s.label}
                </span>
                <span className="ml-3 text-muted-ink">{s.place}</span>
              </span>
              <span className="melange-label shrink-0">{s.live ? "Now" : "Soon"}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ---------------- This week's theme ---------------- */}
      {theme ? (
        <Section id="theme" label="This week's theme">
          <h2 className="break-words font-display text-4xl font-semibold leading-tight sm:text-5xl">
            {theme.title}
          </h2>
          {theme.prompt ? (
            <p className="mt-4 max-w-2xl break-words text-lg leading-relaxed text-muted-ink">
              {theme.prompt}
            </p>
          ) : null}
          <p className="mt-5 text-sm text-muted-ink">
            {theme.posts === 1 ? "1 post so far" : `${theme.posts} posts so far`}. Post yours
            from Explore in the app.
          </p>
        </Section>
      ) : null}

      {/* ---------------- Screens ---------------- */}
      <Section label="The app">
        <div className="grid grid-cols-1 gap-10 min-[480px]:grid-cols-3 min-[480px]:gap-5">
          {SCREENS.map((sc) => (
            <figure key={sc.src} className="w-full max-w-[16rem] min-[480px]:max-w-none">
              <Screenshot src={sc.src} alt={sc.label} />
              <figcaption className="mt-3 text-sm text-muted-ink">{sc.label}</figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-ink">
          Screens from the iPhone app on a demo account; the people in them are placeholders.
        </p>
      </Section>

      {/* ---------------- Safety ---------------- */}
      <Section id="safety" label="Safety">
        <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
          You&apos;re meeting strangers. Here&apos;s what we do about it.
        </h2>
        <ul className="mt-6 max-w-2xl space-y-3 leading-relaxed text-muted-ink">
          <li>Nights are invite-only, so the room is friends of friends.</li>
          <li>
            You can block or report any person, post or message, including in a night
            chat. A person reads every report.
          </li>
          <li>Every account is 18+.</li>
          <li>
            Your data is locked to your account in the database, and you can delete your
            account and everything in it from inside the app.
          </li>
        </ul>
        <p className="mt-6 leading-relaxed text-muted-ink">
          Questions or worries:{" "}
          <Link className="font-medium text-action underline underline-offset-4" href={SUPPORT_PATH}>
            write to us
          </Link>
          .
        </p>
      </Section>

      {/* ---------------- Next night (writes to the waitlist table) ---------------- */}
      <Section id="next-night" label="The next night">
        <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
          Want to hear when there&apos;s a night near you?
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed text-muted-ink">
          Leave your email and your scene. When someone hosts one nearby, we&apos;ll
          send you the link.
        </p>
        <div className="mt-8 max-w-2xl">
          <WaitlistForm />
        </div>
      </Section>

      <SiteFooter />
    </main>
  );
}
