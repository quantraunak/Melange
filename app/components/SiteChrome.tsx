import Link from "next/link";

import Logo from "./Logo";
import { APP_STORE_URL, IOS_LIVE, WEB_APP_PATH } from "../lib/site";

/** Header and footer shared by the landing page and the public pages. */

const navLink = "text-sm text-muted-ink transition hover:text-ink";

export function SiteHeader({ landing = false }: { landing?: boolean }) {
  return (
    <header className="melange-header sticky top-0 z-50">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Logo size="sm" />
          <span className="melange-wordmark hidden text-[1.6rem] leading-none min-[400px]:inline">
            Melange
          </span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          {landing ? (
            <>
              <a href="#how" className={`hidden sm:block ${navLink}`}>
                How it works
              </a>
              <a href="#safety" className={`hidden sm:block ${navLink}`}>
                Safety
              </a>
            </>
          ) : null}
          <Link href="/join" className={navLink}>
            Have a code?
          </Link>
          <Link
            href={WEB_APP_PATH}
            className="rounded-md border border-ink px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
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
    <footer className="border-t border-rule bg-paper">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="melange-wordmark text-xl leading-none">Melange</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link className={navLink} href="/join">
              Have a code?
            </Link>
            <Link className={navLink} href={WEB_APP_PATH}>
              Open the app
            </Link>
            <Link className={navLink} href="/support">
              Support
            </Link>
            <Link className={navLink} href="/privacy">
              Privacy
            </Link>
            <Link className={navLink} href="/terms">
              Terms
            </Link>
          </nav>
        </div>

        <p className="mt-8 text-sm text-muted-ink">© {new Date().getFullYear()} Melange</p>
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
    <section className="mt-16 border-t border-rule pt-10">
      <h2 className="break-words font-display text-3xl font-semibold leading-tight text-ink">
        {heading}
      </h2>
      <p className="mt-3 max-w-md leading-relaxed text-muted-ink">
        Melange is free on iPhone and anyone can sign up. Nights are invite-only: a
        friend sends you the link.
      </p>
      <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
        {IOS_LIVE ? (
          <a
            href={APP_STORE_URL}
            className="melange-btn-primary inline-flex w-full items-center justify-center rounded-lg px-6 py-3 text-base font-semibold text-white sm:w-auto"
          >
            Get the app
          </a>
        ) : null}
        <Link
          href="/#next-night"
          className="text-sm font-medium text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
        >
          Hear about the next night near you
        </Link>
      </div>
    </section>
  );
}

/** The Founding mark. The ✦ means Founding member and is used nowhere else. */
export function FoundingMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-violet-200 px-2 py-0.5 text-xs font-semibold text-violet-800 ${className}`}
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
