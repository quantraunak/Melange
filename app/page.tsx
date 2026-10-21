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
  title: { absolute: "Melange: where creative people find their next collaboration" },
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
    title: "Find people whose work fits yours",
    body: "Discover shows photographers, models, stylists and other creatives near you, and the projects they're putting together. Melange learns your taste from what you make and like.",
  },
  {
    title: "See who's into your work",
    body: "Heart someone's work and they find out it was you. When someone hearts yours, you can write back right away.",
  },
  {
    title: "Meet, and make something",
    body: "Plan it in chat, or meet at an event: everyone going shares a chat before it and a private photo roll after it.",
  },
  {
    title: "Get credit for it",
    body: "Post what you made and credit everyone on it. It shows on your profile, and on theirs.",
  },
];

// Captured from the iOS app (1.7) on a demo account, so every face and name
// in them is seeded demo content, not a real user.
const SCREENS = [
  { src: "/screenshots/discover.png", label: "Discover: people in your scene." },
  { src: "/screenshots/explore.png", label: "Shoots people made, with everyone credited." },
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
              Where creative people find their next collaboration.
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-ink">
              A photographer needs a model. A model needs a stylist. A filmmaker
              needs a whole crew. On Melange you find people whose work fits
              yours, see who&apos;s into what you make, and make something
              together.
            </p>

            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
              <GetAppCta />
              <a
                href="#updates"
                className="text-sm font-medium text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
              >
                Or get updates when we open near you
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

      {/* ---------------- How it works ---------------- */}
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

      {/* ---------------- Tables ---------------- */}
      <Section id="tables" label="Who you sit with">
        <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
          Melange learns your taste, and checks itself against random picks.
        </h2>
        <div className="mt-6 max-w-2xl space-y-4 text-lg leading-relaxed text-muted-ink">
          <p>
            We read taste from what you make and what you heart: the photos, not your face. That
            tells us whose work belongs together, and whose roles make each other&apos;s work
            possible, so we can suggest who to meet and seat groups at events.
          </p>
          <p>
            Then we check. At an event, half the tables are ours and half are random, and we
            compare who hearted each other, who was still talking a week later, and who came back.
            If our suggestions aren&apos;t better than chance, we&apos;ll change them.
          </p>
        </div>
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
            {/* A zero reads as an empty room; only count once there's something to count. */}
            {theme.posts > 0
              ? `${theme.posts === 1 ? "1 post" : `${theme.posts} posts`} so far. `
              : ""}
            Post yours from Explore in the app.
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
          <li>Events are shared by friends, so the room is friends of friends.</li>
          <li>
            You can block or report any person, post or message, including in an event
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

      {/* ---------------- Updates (writes to the waitlist table) ---------------- */}
      <Section id="updates" label="Updates">
        <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
          Not in USC, UCSD or LA?
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed text-muted-ink">
          Leave your email and where you are. We&apos;ll tell you when Melange opens near you,
          and when there&apos;s an event close by.
        </p>
        <div className="mt-8 max-w-2xl">
          <WaitlistForm />
        </div>
      </Section>

      <SiteFooter />
    </main>
  );
}
