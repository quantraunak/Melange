import Link from "next/link";

import Logo from "./Logo";
import { APP_STORE_URL, IOS_LIVE, WEB_APP_PATH } from "../lib/site";

/** Header and footer shared by the landing page and the public pages. */

export function SiteHeader({ landing = false }: { landing?: boolean }) {
  return (
    <header className="melange-header sticky top-0 z-50">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Logo size="sm" />
          <span className="melange-wordmark hidden text-2xl font-bold min-[400px]:inline">Melange</span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          {landing ? (
            <>
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
            </>
          ) : null}
          <Link
            href="/join"
            className="text-sm font-medium text-slate-600 transition hover:text-indigo-700"
          >
            Have a code?
          </Link>
          <Link
            href={WEB_APP_PATH}
            className="melange-btn-primary rounded-lg px-4 py-2 text-sm font-semibold text-white"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size="sm" />
            <span className="melange-wordmark text-xl font-bold">Melange</span>
          </Link>

          <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm text-slate-600">
            <Link className="transition hover:text-indigo-700" href="/join">
              Have a code?
            </Link>
            <Link className="transition hover:text-indigo-700" href={WEB_APP_PATH}>
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
          </nav>
        </div>

        <p className="mt-9 text-center text-sm text-slate-400 sm:text-left">
          © {new Date().getFullYear()} Melange. Made for people who make things.
        </p>
      </div>
    </footer>
  );
}

/**
 * The closing CTA on the public pages: the app is open to anyone (primary),
 * nights are invite-only (secondary, the list on the landing page).
 */
export function GetTheAppCta({ heading }: { heading: string }) {
  return (
    <section className="melange-bg mt-16 rounded-3xl px-6 py-10 text-center">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">{heading}</h2>
      <p className="mx-auto mt-3 max-w-md text-slate-600">
        Where young creatives find their crew. Free on iPhone; the nights are invite-only.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {IOS_LIVE ? (
          <a
            href={APP_STORE_URL}
            className="melange-btn-primary inline-flex w-full items-center justify-center rounded-xl px-7 py-3.5 text-base font-semibold text-white sm:w-auto"
          >
            Get the app
          </a>
        ) : null}
        <Link
          href="/#next-night"
          className="text-sm font-medium text-indigo-700 underline underline-offset-4"
        >
          Get on the list for the next night
        </Link>
      </div>
    </section>
  );
}

/** The ✦ Founding mark. The ✦ is the only ornament. */
export function FoundingMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-800 ${className}`}
    >
      ✦ Founding
    </span>
  );
}

/**
 * Plain <img> for user photos: they come from Supabase storage (and avatars
 * can come from elsewhere), and next/image throws on any host not listed in
 * remotePatterns, which would turn one odd URL into a 500. max-w-full and
 * w-full keep an intrinsic-width image from widening the page on phones.
 */
export function RemoteImg({
  src,
  alt,
  className = "",
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`block max-w-full ${className}`}
    />
  );
}
